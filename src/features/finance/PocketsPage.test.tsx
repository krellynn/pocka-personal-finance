import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { PocketsPage } from "./PocketsPage";

vi.mock("./api", () => ({ fetchWorkspace: vi.fn(), fetchPockets: vi.fn(), fetchPocketSummary: vi.fn(), callLedger: vi.fn(), renamePocket: vi.fn(), fetchPocketMovements: vi.fn(), MOVEMENTS_LIMIT: 50 }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pocket = (over: Partial<Awaited<ReturnType<typeof api.fetchPockets>>[number]>) => ({
  id: "p1", name: "Darurat", balance: "0", target_amount: null, archived_at: null, ...over,
});

type Movements = Awaited<ReturnType<typeof api.fetchPocketMovements>>;
function renderPage(pockets: ReturnType<typeof pocket>[], summary: Awaited<ReturnType<typeof api.fetchPocketSummary>>, movements: Movements = []) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchPockets).mockResolvedValue(pockets);
  vi.mocked(api.fetchPocketSummary).mockResolvedValue(summary);
  vi.mocked(api.fetchPocketMovements).mockResolvedValue(movements);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PocketsPage />
    </QueryClientProvider>,
  );
}

describe("PocketsPage", () => {
  it("shows the summary and pocket balances exactly", async () => {
    renderPage(
      [pocket({ balance: "999999999999999", target_amount: "1000000000000000" }), pocket({ id: "p2", name: "Lama", archived_at: "2026-11-01" })],
      { eligible_funds: "1000000", allocated: "400000", unallocated: "600000", is_shortfall: false },
    );
    expect(await screen.findByText("Rp999.999.999.999.999")).toBeInTheDocument();
    expect(screen.getByText("Target Rp1.000.000.000.000.000")).toBeInTheDocument();
    expect(screen.getByText("Rp600.000")).toBeInTheDocument();
    expect(screen.getByText("Diarsipkan (1)")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns on a shortfall with a negative unallocated amount", async () => {
    renderPage([pocket({ balance: "500000" })], { eligible_funds: "300000", allocated: "500000", unallocated: "-200000", is_shortfall: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("melebihi saldo akun");
    expect(screen.getByText("-Rp200.000")).toBeInTheDocument();
  });

  it("shows the empty state", async () => {
    renderPage([], { eligible_funds: "0", allocated: "0", unallocated: "0", is_shortfall: false });
    expect(await screen.findByText("Belum ada pocket.")).toBeInTheDocument();
  });

  it("creates a pocket with the target as a digit string", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderPage([], { eligible_funds: "0", allocated: "0", unallocated: "0", is_shortfall: false });
    await screen.findByText("Belum ada pocket.");
    fireEvent.change(screen.getByLabelText("Nama pocket"), { target: { value: " Liburan " } });
    fireEvent.change(screen.getByLabelText("Target (opsional)"), { target: { value: "Rp 5.000.000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan pocket" }));
    expect(await screen.findByText("Pocket tersimpan.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("create_pocket", expect.objectContaining({ p_workspace_id: "w1", p_name: "Liburan", p_target_amount: "5000000" }));
  });

  it("shows a duplicate name error", async () => {
    vi.mocked(api.callLedger).mockRejectedValue({ code: "P0001", message: "VALIDATION_FAILED", details: "name taken" });
    renderPage([], { eligible_funds: "0", allocated: "0", unallocated: "0", is_shortfall: false });
    await screen.findByText("Belum ada pocket.");
    fireEvent.change(screen.getByLabelText("Nama pocket"), { target: { value: "Darurat" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan pocket" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nama pocket ini sudah dipakai.");
  });

  it("archives an empty pocket and blocks one with a balance", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderPage([pocket({}), pocket({ id: "p2", name: "Isi", balance: "1000" })], { eligible_funds: "1000", allocated: "1000", unallocated: "0", is_shortfall: false });
    expect(await screen.findByRole("button", { name: "Arsipkan Isi" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Arsipkan Darurat" }));
    expect(await screen.findByText("Pocket diarsipkan.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("set_pocket_archived", { p_workspace_id: "w1", p_pocket_id: "p1", p_archived: true });
  });

  it("renames a pocket with a trimmed name and maps a duplicate", async () => {
    vi.mocked(api.renamePocket).mockRejectedValueOnce({ code: "23505", message: "duplicate key" }).mockResolvedValueOnce(undefined);
    renderPage([pocket({})], { eligible_funds: "0", allocated: "0", unallocated: "0", is_shortfall: false });
    fireEvent.click(await screen.findByRole("button", { name: "Ganti nama Darurat" }));
    const input = screen.getAllByLabelText("Nama pocket")[0]!;
    fireEvent.change(input, { target: { value: " Liburan " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan nama" }));
    expect(await screen.findByText("Nama pocket ini sudah dipakai.")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Dana Darurat" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan nama" }));
    expect(await screen.findByText("Nama pocket diperbarui.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ganti nama Darurat" })).toHaveFocus();
    expect(api.renamePocket).toHaveBeenNthCalledWith(1, "p1", "Liburan");
    expect(api.renamePocket).toHaveBeenNthCalledWith(2, "p1", "Dana Darurat");
  });

  it("lists movements with Belum dialokasikan for the empty side", async () => {
    renderPage([pocket({ balance: "300000" }), pocket({ id: "p2", name: "Liburan", balance: "50000" })],
      { eligible_funds: "1000000", allocated: "350000", unallocated: "650000", is_shortfall: false },
      [
        { id: "m2", from_pocket_id: "p1", to_pocket_id: "p2", amount: "50000", note: "tiket", created_at: "2026-11-25T18:00:00Z" },
        { id: "m1", from_pocket_id: null, to_pocket_id: "p1", amount: "999999999999999", note: null, created_at: "2026-11-01T01:00:00Z" },
      ]);
    expect(await screen.findByText("Darurat → Liburan")).toBeInTheDocument();
    expect(screen.getByText("Belum dialokasikan → Darurat")).toBeInTheDocument();
    expect(screen.getByText("2026-11-26 · tiket")).toBeInTheDocument();
    expect(screen.getByText("Rp999.999.999.999.999")).toBeInTheDocument();
  });
});
