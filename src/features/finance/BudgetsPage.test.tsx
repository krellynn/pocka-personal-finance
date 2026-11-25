import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { BudgetsPage } from "./BudgetsPage";

vi.mock("./api", () => ({ fetchWorkspace: vi.fn(), fetchBudgetVsActual: vi.fn(), fetchCategories: vi.fn(), setBudget: vi.fn(), copyBudgets: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));
vi.mock("../../lib/datetime/todayInTimeZone", () => ({ todayInTimeZone: () => "2026-11-26" }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Row = Awaited<ReturnType<typeof api.fetchBudgetVsActual>>[number];
const row = (over: Partial<Row>): Row => ({
  category_id: "c1", category_name: "Makan & Minum", category_archived: false, has_budget: true,
  planned: "750000", actual: "700000", remaining: "50000", is_over: false, ...over,
});

function renderPage(rows: Row[]) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchBudgetVsActual).mockResolvedValue(rows);
  vi.mocked(api.fetchCategories).mockResolvedValue([
    { id: "c1", kind: "expense", name: "Makan & Minum", archived_at: null },
    { id: "c9", kind: "income", name: "Gaji", archived_at: null },
    { id: "c8", kind: "expense", name: "Lama", archived_at: "2026-01-01" },
  ]);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <BudgetsPage />
    </QueryClientProvider>,
  );
}

describe("BudgetsPage", () => {
  it("shows plan vs actual, unbudgeted spending and exact totals", async () => {
    renderPage([
      row({ planned: "999999999999999", actual: "1000000000000000", remaining: "-1", is_over: true }),
      row({ category_id: "c2", category_name: "Transportasi", has_budget: false, planned: null, actual: "50000", remaining: null }),
    ]);
    expect(await screen.findByText("Lewat anggaran")).toBeInTheDocument();
    expect(api.fetchBudgetVsActual).toHaveBeenCalledWith("w1", "2026-11-01");
    expect(screen.getByText("Tanpa anggaran")).toBeInTheDocument();
    const total = screen.getByRole("row", { name: /Total/ });
    expect(within(total).getByText("Rp1.000.000.000.050.000")).toBeInTheDocument();
    expect(within(total).getByText("-Rp1")).toBeInTheDocument();
  });

  it("sets a plan for an active expense category only", async () => {
    vi.mocked(api.setBudget).mockResolvedValue(undefined);
    renderPage([]);
    expect(await screen.findByText("Belum ada anggaran atau pengeluaran di bulan ini.")).toBeInTheDocument();
    const select = await screen.findByLabelText("Kategori pengeluaran");
    await within(select).findByText("Makan & Minum");
    expect(within(select).queryByText("Gaji")).not.toBeInTheDocument();
    expect(within(select).queryByText("Lama")).not.toBeInTheDocument();
    fireEvent.change(select, { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Jumlah rencana"), { target: { value: "Rp 1.250.000" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan anggaran" }));
    expect(await screen.findByText("Anggaran tersimpan.")).toBeInTheDocument();
    expect(api.setBudget).toHaveBeenCalledWith("w1", "2026-11-01", "c1", "1250000");
  });

  it("sends 0 to remove a plan", async () => {
    vi.mocked(api.setBudget).mockResolvedValue(undefined);
    renderPage([]);
    const select = await screen.findByLabelText("Kategori pengeluaran");
    await within(select).findByText("Makan & Minum");
    fireEvent.change(select, { target: { value: "c1" } });
    fireEvent.change(screen.getByLabelText("Jumlah rencana"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan anggaran" }));
    expect(await screen.findByText("Anggaran tersimpan.")).toBeInTheDocument();
    expect(api.setBudget).toHaveBeenCalledWith("w1", "2026-11-01", "c1", "0");
  });

  it("copies last month's plans into the shown month", async () => {
    vi.mocked(api.copyBudgets).mockResolvedValue(3);
    renderPage([]);
    fireEvent.click(await screen.findByRole("button", { name: "Salin dari bulan lalu" }));
    expect(await screen.findByText("3 kategori disalin dari bulan lalu.")).toBeInTheDocument();
    expect(api.copyBudgets).toHaveBeenCalledWith("w1", "2026-10-01", "2026-11-01");
  });
});
