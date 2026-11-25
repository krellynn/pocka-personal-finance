import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { AccountsPage } from "./AccountsPage";

vi.mock("./api", () => ({ fetchWorkspace: vi.fn(), fetchAccounts: vi.fn(), callLedger: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const account = (over: Partial<Awaited<ReturnType<typeof api.fetchAccounts>>[number]>) => ({
  id: "a1", kind: "bank", name: "BCA", currency: "IDR", balance: "0", archived_at: null, ...over,
});

function renderPage(accounts = [account({})]) {
  vi.mocked(api.fetchWorkspace).mockResolvedValue({ id: "w1", timezone: "Asia/Jakarta", base_currency: "IDR" });
  vi.mocked(api.fetchAccounts).mockResolvedValue(accounts);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <AccountsPage />
    </QueryClientProvider>,
  );
}

const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Simpan akun" }));

describe("AccountsPage", () => {
  it("lists balances exactly, with card debt labelled", async () => {
    renderPage([account({ balance: "999999999999999" }), account({ id: "a2", kind: "credit_card", name: "Visa", balance: "250000" })]);
    expect(await screen.findByText("Rp999.999.999.999.999")).toBeInTheDocument();
    expect(screen.getByText("Tagihan")).toBeInTheDocument();
    expect(screen.getByText("Rp250.000")).toBeInTheDocument();
  });

  it("creates an account with the typed amount as a digit string", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ financial_account_id: "a9", replayed: false });
    renderPage();
    await screen.findByRole("heading", { name: "Daftar akun" }); await screen.findAllByText("BCA");
    fill("Nama akun", "  Dompet  ");
    fill("Saldo awal", "Rp 1.500.000");
    submit();
    expect(await screen.findByText("Akun tersimpan.")).toHaveAttribute("role", "status");
    expect(api.callLedger).toHaveBeenCalledWith("create_financial_account", expect.objectContaining({
      p_workspace_id: "w1", p_kind: "bank", p_name: "Dompet", p_opening_balance: "1500000",
    }));
  });

  it("reuses the idempotency key on a retry after a network failure, and not after an edit", async () => {
    vi.mocked(api.callLedger).mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderPage();
    await screen.findByRole("heading", { name: "Daftar akun" }); await screen.findAllByText("BCA");
    fill("Nama akun", "Kas");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal menyimpan. Coba lagi.");
    submit();
    await waitFor(() => expect(api.callLedger).toHaveBeenCalledTimes(2));
    fill("Nama akun", "Kas kecil");
    submit();
    await waitFor(() => expect(api.callLedger).toHaveBeenCalledTimes(3));
    const keys = vi.mocked(api.callLedger).mock.calls.map((c) => c[1].p_idempotency_key);
    expect(keys[1]).toBe(keys[0]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  it("rejects a bad amount and a missing name without calling the server", async () => {
    renderPage();
    await screen.findByRole("heading", { name: "Daftar akun" }); await screen.findAllByText("BCA");
    fill("Saldo awal", "1,5");
    submit();
    expect(await screen.findByText("Nama akun wajib diisi, maksimal 80 karakter.")).toBeInTheDocument();
    expect(screen.getByText("Tulis jumlah dalam Rupiah tanpa desimal, misalnya Rp1.500.000.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
  });

  it("blocks archiving while there is a balance and shows the server reason if it races", async () => {
    vi.mocked(api.callLedger).mockRejectedValue({ code: "P0001", message: "RESOURCE_HAS_BALANCE" });
    renderPage([account({ balance: "5000" }), account({ id: "a2", name: "Kosong" })]);
    expect(await screen.findByRole("button", { name: "Arsipkan BCA" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Arsipkan Kosong" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Masih ada saldo");
    expect(api.callLedger).toHaveBeenCalledWith("set_financial_account_archived", { p_workspace_id: "w1", p_account_id: "a2", p_archived: true });
  });
});

describe("AccountsPage server messages", () => {
  it("names a duplicate account name instead of a generic validation error", async () => {
    vi.mocked(api.callLedger).mockRejectedValue({ code: "P0001", message: "VALIDATION_FAILED", details: "name taken" });
    renderPage();
    await screen.findAllByText("BCA");
    fill("Nama akun", "BCA");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Nama akun ini sudah dipakai");
  });

  it("confirms an archive in the status region", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ financial_account_id: "a1", replayed: false });
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Arsipkan BCA" }));
    expect(await screen.findByText("Akun diarsipkan.")).toHaveAttribute("role", "status");
  });
});
