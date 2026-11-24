import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import * as api from "./api";
import { TransactionForm } from "./TransactionForm";

vi.mock("./api", () => ({ fetchAccounts: vi.fn(), fetchCategories: vi.fn(), callLedger: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const acc = (id: string, name: string, kind = "bank", archived_at: string | null = null) => ({ id, name, kind, currency: "IDR", balance: "0", archived_at });

async function renderForm() {
  vi.mocked(api.fetchAccounts).mockResolvedValue([
    acc("bca", "BCA"), acc("kas", "Kas", "cash"), acc("visa", "Visa", "credit_card"), acc("old", "Lama", "bank", "2026-01-01"),
  ]);
  vi.mocked(api.fetchCategories).mockResolvedValue([
    { id: "food", kind: "expense", name: "Makan", archived_at: null },
    { id: "gone", kind: "expense", name: "Dulu", archived_at: "2026-01-01" },
    { id: "salary", kind: "income", name: "Gaji", archived_at: null },
  ]);
  vi.mocked(api.callLedger).mockResolvedValue({ transaction_id: "t1", replayed: false });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <TransactionForm workspaceId="w1" timeZone="Asia/Jakarta" />
    </QueryClientProvider>,
  );
  await screen.findByRole("option", { name: "BCA" });
}

const choose = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const options = (label: string) => within(screen.getByLabelText(label)).getAllByRole("option").map((o) => o.textContent);
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Simpan transaksi" }));
const today = todayInTimeZone("Asia/Jakarta");

describe("TransactionForm", () => {
  it("posts an expense as a digit string with active accounts and categories only", async () => {
    await renderForm();
    expect(options("Akun")).toEqual(["Pilih...", "BCA", "Kas", "Visa"]);
    expect(options("Kategori")).toEqual(["Pilih...", "Makan"]);
    choose("Akun", "visa");
    choose("Kategori", "food");
    choose("Jumlah", "Rp 75.500");
    submit();
    expect(await screen.findByText("Transaksi tersimpan.")).toHaveAttribute("role", "status");
    expect(api.callLedger).toHaveBeenCalledWith("post_expense", expect.objectContaining({
      p_workspace_id: "w1", p_account_id: "visa", p_category_id: "food", p_amount: "75500", p_occurred_on: today, p_note: null,
    }));
  });

  it("posts income only into an asset account, with an income category", async () => {
    await renderForm();
    fireEvent.click(screen.getByLabelText("Pemasukan"));
    expect(options("Akun")).toEqual(["Pilih...", "BCA", "Kas"]);
    expect(options("Kategori")).toEqual(["Pilih...", "Gaji"]);
    choose("Akun", "bca");
    choose("Kategori", "salary");
    choose("Jumlah", "10000000");
    choose("Catatan (opsional)", "  November  ");
    submit();
    await waitFor(() => expect(api.callLedger).toHaveBeenCalledWith("post_income", expect.objectContaining({ p_amount: "10000000", p_note: "November" })));
  });

  it("clears a card picked for an expense when switching to income", async () => {
    await renderForm();
    choose("Akun", "visa");
    fireEvent.click(screen.getByLabelText("Pemasukan"));
    choose("Kategori", "salary");
    choose("Jumlah", "1000");
    submit();
    expect(await screen.findByText("Pilih akun.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
  });

  it("posts a transfer between two different accounts", async () => {
    await renderForm();
    fireEvent.click(screen.getByLabelText("Transfer"));
    expect(options("Dari akun")).toEqual(["Pilih...", "BCA", "Kas"]);
    choose("Dari akun", "bca");
    expect(options("Ke akun")).toEqual(["Pilih...", "Kas", "Visa"]);
    choose("Ke akun", "visa");
    choose("Jumlah", "Rp 250.000");
    submit();
    await waitFor(() => expect(api.callLedger).toHaveBeenCalledWith("post_transfer", expect.objectContaining({
      p_from_account_id: "bca", p_to_account_id: "visa", p_amount: "250000",
    })));
  });

  it("blocks a future date, a zero amount and missing picks without calling the server", async () => {
    await renderForm();
    choose("Jumlah", "0");
    choose("Tanggal", "2999-01-01");
    submit();
    expect(await screen.findByText("Tanggal tidak boleh di masa depan.")).toBeInTheDocument();
    expect(screen.getByText(/Tulis jumlah lebih dari nol/)).toBeInTheDocument();
    expect(screen.getByText("Pilih akun.")).toBeInTheDocument();
    expect(screen.getByText("Pilih kategori.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
  });

  it("shows the server reason when the account was archived meanwhile", async () => {
    await renderForm();
    vi.mocked(api.callLedger).mockRejectedValue({ code: "P0001", message: "RESOURCE_ARCHIVED" });
    choose("Akun", "bca");
    choose("Kategori", "food");
    choose("Jumlah", "5000");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("Akun atau kategori ini sudah diarsipkan.");
  });
});
