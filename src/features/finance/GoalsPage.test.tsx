import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { GoalsPage } from "./GoalsPage";

vi.mock("./api", () => ({ fetchWorkspace: vi.fn(), fetchGoals: vi.fn(), fetchPockets: vi.fn(), callLedger: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Goal = Awaited<ReturnType<typeof api.fetchGoals>>[number];
const goal = (over: Partial<Goal>): Goal => ({
  id: "g1", name: "Dana Darurat", target_amount: "5000000", target_date: null, notes: null, pocket_id: null,
  archived_at: null, saved: "0", remaining: "5000000", percent: 0, is_reached: false, ...over,
});
const pockets = [
  { id: "p1", name: "Darurat", balance: "0", target_amount: null, archived_at: null },
  { id: "p2", name: "Liburan", balance: "0", target_amount: null, archived_at: null },
  { id: "p3", name: "Lama", balance: "0", target_amount: null, archived_at: "2026-11-01" },
];

function renderPage(goals: Goal[]) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchGoals).mockResolvedValue(goals);
  vi.mocked(api.fetchPockets).mockResolvedValue(pockets);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <GoalsPage />
    </QueryClientProvider>,
  );
}

describe("GoalsPage", () => {
  it("shows progress exactly, including 15-digit amounts", async () => {
    renderPage([
      goal({ name: "Rumah", target_amount: "999999999999999", saved: "999999999999999", remaining: "0", percent: 100, is_reached: true, pocket_id: "p1" }),
      goal({ id: "g2", name: "Motor", saved: "0", pocket_id: null }),
    ]);
    expect(await screen.findByText("Rp999.999.999.999.999 dari Rp999.999.999.999.999 · 100%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Rumah" })).toHaveAttribute("aria-valuenow", "100");
    expect(screen.getByText("Tercapai")).toBeInTheDocument();
    expect(screen.getByText("Pocket: Darurat")).toBeInTheDocument();
    expect(screen.getByText(/Belum terhubung ke pocket/)).toBeInTheDocument();
  });

  it("shows the empty state and lists archived goals apart", async () => {
    renderPage([goal({ archived_at: "2026-11-01" })]);
    expect(await screen.findByText("Belum ada target.")).toBeInTheDocument();
    expect(screen.getByText("Diarsipkan (1)")).toBeInTheDocument();
  });

  it("creates a goal with the amount as a digit string and a linked pocket", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderPage([]);
    await screen.findByText("Belum ada target.");
    fireEvent.change(screen.getByLabelText("Nama target"), { target: { value: " Liburan " } });
    fireEvent.change(screen.getByLabelText("Jumlah target"), { target: { value: "Rp 5.000.000" } });
    fireEvent.change(screen.getByLabelText("Tanggal target (opsional)"), { target: { value: "2099-01-01" } });
    fireEvent.change(screen.getByLabelText("Hubungkan ke pocket (opsional)"), { target: { value: "p2" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan target" }));
    expect(await screen.findByText("Target tersimpan.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("create_goal", expect.objectContaining({
      p_workspace_id: "w1", p_name: " Liburan ", p_target_amount: "5000000", p_target_date: "2099-01-01", p_pocket_id: "p2", p_note: null,
    }));
  });

  it("validates before calling the server", async () => {
    renderPage([]);
    await screen.findByText("Belum ada target.");
    fireEvent.click(screen.getByRole("button", { name: "Simpan target" }));
    expect(await screen.findByText("Nama wajib diisi, maksimal 60 karakter.")).toBeInTheDocument();
    expect(screen.getByText("Masukkan jumlah yang valid, lebih dari 0.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
  });

  it("maps a duplicate name and a linked pocket", async () => {
    vi.mocked(api.callLedger)
      .mockRejectedValueOnce({ code: "P0001", message: "VALIDATION_FAILED", details: "name taken" })
      .mockRejectedValueOnce({ code: "P0001", message: "POCKET_ALREADY_LINKED", details: "" });
    renderPage([]);
    await screen.findByText("Belum ada target.");
    fireEvent.change(screen.getByLabelText("Nama target"), { target: { value: "Dana" } });
    fireEvent.change(screen.getByLabelText("Jumlah target"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan target" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nama target ini sudah dipakai.");
    fireEvent.change(screen.getByLabelText("Nama target"), { target: { value: "Dana Lain" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan target" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Pocket ini sudah dipakai target lain.");
  });

  it("offers only free active pockets, but keeps the goal's own pocket when editing", async () => {
    renderPage([goal({ pocket_id: "p1" })]);
    await screen.findByText("Dana Darurat");
    const select = () => screen.getByLabelText("Hubungkan ke pocket (opsional)") as HTMLSelectElement;
    expect([...select().options].map((o) => o.text)).toEqual(["Tanpa pocket", "Liburan"]);
    fireEvent.click(screen.getByRole("button", { name: "Ubah Dana Darurat" }));
    expect([...select().options].map((o) => o.text)).toEqual(["Tanpa pocket", "Darurat", "Liburan"]);
    expect(select().value).toBe("p1");
  });

  it("keeps an archived own pocket selected when editing, so it is not silently unlinked", async () => {
    renderPage([goal({ pocket_id: "p3" })]);
    fireEvent.click(await screen.findByRole("button", { name: "Ubah Dana Darurat" }));
    expect((screen.getByLabelText("Hubungkan ke pocket (opsional)") as HTMLSelectElement).value).toBe("p3");
  });

  it("edits a goal through update_goal and archives through set_goal_archived", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderPage([goal({})]);
    fireEvent.click(await screen.findByRole("button", { name: "Ubah Dana Darurat" }));
    expect(screen.getByLabelText("Jumlah target")).toHaveValue("Rp5.000.000");
    fireEvent.change(screen.getByLabelText("Jumlah target"), { target: { value: "6000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan target" }));
    expect(await screen.findByText("Target diperbarui.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("update_goal", expect.objectContaining({ p_goal_id: "g1", p_target_amount: "6000000", p_name: "Dana Darurat" }));
    fireEvent.click(screen.getByRole("button", { name: "Arsipkan Dana Darurat" }));
    await vi.waitFor(() => expect(api.callLedger).toHaveBeenCalledWith("set_goal_archived", { p_workspace_id: "w1", p_goal_id: "g1", p_archived: true }));
  });
});
