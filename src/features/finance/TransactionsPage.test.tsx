import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { monthRange } from "../../lib/datetime/monthRange";
import * as api from "./api";
import { sumTotals } from "./money";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("./api", () => ({
  FEED_LIMIT: 100, fetchWorkspace: vi.fn(), fetchAccounts: vi.fn(), fetchCategories: vi.fn(), callLedger: vi.fn(), fetchFeed: vi.fn(), fetchPeriodTotals: vi.fn(),
}));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const row = (over: Partial<Awaited<ReturnType<typeof api.fetchFeed>>[number]>) => ({
  id: "t1", kind: "expense", occurred_on: "2026-11-20", amount: "75000", note: null, account_id: "a1", account_name: "BCA", counter_account_name: null, category_id: "c1",
  category_name: "Makan", is_reversed: false, refunded_amount: "0", reverses_id: null, signed_amount: "75000", ...over,
});

function renderPage(feed = [row({})]) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchAccounts).mockResolvedValue([]);
  vi.mocked(api.fetchCategories).mockResolvedValue([]);
  vi.mocked(api.fetchFeed).mockResolvedValue(feed);
  vi.mocked(api.fetchPeriodTotals).mockResolvedValue([
    { category_id: "c1", category_name: "Gaji", kind: "income", total: "10000000" },
    { category_id: "c2", category_name: "Makan", kind: "expense", total: "75000" },
    { category_id: "c3", category_name: "Belanja", kind: "expense", total: "25000" },
  ]);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TransactionsPage />
    </QueryClientProvider>,
  );
}

describe("sumTotals and monthRange", () => {
  it("sums as bigint beyond Number precision", () => {
    expect(sumTotals([{ kind: "income", total: "999999999999999" }, { kind: "income", total: "999999999999999" }, { kind: "expense", total: null }]))
      .toEqual({ income: 1999999999999998n, expense: 0n, net: 1999999999999998n });
  });

  it("knows month lengths, including leap years", () => {
    expect(monthRange("2026-11")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(monthRange("2026-12")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});

describe("TransactionsPage", () => {
  it("shows the month totals and a signed list", async () => {
    renderPage([row({}), row({ id: "t2", kind: "transfer", amount: "50000", account_name: "BCA", counter_account_name: "Kas", category_name: null })]);
    expect(await screen.findByText("Rp10.000.000")).toBeInTheDocument();
    expect(screen.getByText("Rp100.000")).toBeInTheDocument();
    expect(screen.getByText("Rp9.900.000")).toBeInTheDocument();
    expect(await screen.findByText("-Rp75.000")).toBeInTheDocument();
    expect(screen.getByText("BCA → Kas")).toBeInTheDocument();
    expect(screen.getByText("Rp50.000")).toBeInTheDocument();
  });

  it("marks reversed rows and refunds", async () => {
    renderPage([row({ is_reversed: true }), row({ id: "t2", refunded_amount: "20000" })]);
    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]!).getByText("Dibatalkan")).toBeInTheDocument();
    expect(within(items[1]!).getByText("Refund Rp20.000")).toBeInTheDocument();
  });

  it("says so when the month is empty and reloads for another month", async () => {
    renderPage([]);
    expect(await screen.findByText("Belum ada transaksi di bulan ini.")).toHaveAttribute("role", "status");
    fireEvent.change(screen.getByLabelText("Bulan"), { target: { value: "2026-02" } });
    await waitFor(() => expect(api.fetchFeed).toHaveBeenCalledWith("w1", "2026-02-01", "2026-02-28"));
  });
});
