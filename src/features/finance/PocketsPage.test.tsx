import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { PocketsPage } from "./PocketsPage";

vi.mock("./api", () => ({ fetchWorkspace: vi.fn(), fetchPockets: vi.fn(), fetchPocketSummary: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pocket = (over: Partial<Awaited<ReturnType<typeof api.fetchPockets>>[number]>) => ({
  id: "p1", name: "Darurat", balance: "0", target_amount: null, archived_at: null, ...over,
});

function renderPage(pockets: ReturnType<typeof pocket>[], summary: Awaited<ReturnType<typeof api.fetchPocketSummary>>) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchPockets).mockResolvedValue(pockets);
  vi.mocked(api.fetchPocketSummary).mockResolvedValue(summary);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
});
