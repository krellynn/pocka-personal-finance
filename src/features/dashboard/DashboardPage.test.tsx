import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "../finance/api";
import { DashboardPage } from "./DashboardPage";

vi.mock("../finance/api", () => ({ fetchWorkspace: vi.fn(), fetchAccounts: vi.fn(), fetchFeed: vi.fn(), fetchPeriodTotals: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(cleanup);

describe("DashboardPage", () => {
  it("sums asset balances without card debt and shows this month's totals", async () => {
    vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
    vi.mocked(api.fetchAccounts).mockResolvedValue([
      { id: "a", kind: "bank", name: "BCA", currency: "IDR", balance: "1425000", archived_at: null },
      { id: "b", kind: "cash", name: "Kas", currency: "IDR", balance: "-25000", archived_at: null },
      { id: "c", kind: "credit_card", name: "Visa", currency: "IDR", balance: "300000", archived_at: null },
      { id: "d", kind: "bank", name: "Lama", currency: "IDR", balance: "999", archived_at: "2026-01-01" },
    ]);
    vi.mocked(api.fetchPeriodTotals).mockResolvedValue([
      { category_id: "x", category_name: "Gaji", kind: "income", total: "5000000" },
      { category_id: "y", category_name: "Makan", kind: "expense", total: "75000" },
    ]);
    vi.mocked(api.fetchFeed).mockResolvedValue([]);
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter><DashboardPage /></MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Rp1.400.000")).toBeInTheDocument();
    expect(await screen.findByText("Rp5.000.000")).toBeInTheDocument();
    expect(screen.getAllByText("Rp75.000").length).toBeGreaterThan(0);
    expect(screen.queryByText("Lama")).toBeNull();
    expect(screen.getByRole("link", { name: "Tambah transaksi" })).toHaveAttribute("href", "/transactions");
  });
});
