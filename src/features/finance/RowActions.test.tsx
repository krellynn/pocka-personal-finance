import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { RowActions } from "./RowActions";

vi.mock("./api", () => ({ fetchAccounts: vi.fn(), fetchCategories: vi.fn(), callLedger: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

type Row = Parameters<typeof RowActions>[0]["row"];
const row = (over: Partial<Row>): Row => ({
  id: "t1", kind: "expense", occurred_on: "2026-11-20", amount: "50000", note: "lama", account_id: "bca", account_name: "BCA",
  counter_account_name: null, category_id: "food", category_name: "Makan", is_reversed: false, refunded_amount: "0", reverses_id: null, ...over,
});

function renderActions(r: Row) {
  vi.mocked(api.fetchAccounts).mockResolvedValue([
    { id: "bca", kind: "bank", name: "BCA", currency: "IDR", balance: "0", archived_at: null },
    { id: "kas", kind: "cash", name: "Kas", currency: "IDR", balance: "0", archived_at: null },
  ]);
  vi.mocked(api.fetchCategories).mockResolvedValue([
    { id: "food", kind: "expense", name: "Makan", archived_at: null },
    { id: "fun", kind: "expense", name: "Hiburan", archived_at: null },
  ]);
  vi.mocked(api.callLedger).mockResolvedValue({ transaction_id: "x", replayed: false });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <RowActions row={r} workspaceId="w1" timeZone="Asia/Jakarta" onSaved={onSaved} />
    </QueryClientProvider>,
  );
}

const onSaved = vi.fn();
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const lastCall = () => vi.mocked(api.callLedger).mock.calls.at(-1)!;

describe("RowActions", () => {
  it("offers refund, edit and reverse on a plain expense, nothing on a reversed one", () => {
    renderActions(row({}));
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Refund", "Ubah", "Batalkan"]);
    cleanup();
    renderActions(row({ is_reversed: true }));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("hides reverse once refunded and defaults the refund to the remaining amount and original account", async () => {
    renderActions(row({ refunded_amount: "20000" }));
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Refund", "Ubah"]);
    click("Refund");
    await screen.findByRole("option", { name: "Kas" });
    expect(screen.getByLabelText("Jumlah")).toHaveValue("Rp30.000");
    expect(screen.getByLabelText("Uang kembali ke akun")).toHaveValue("bca");
    fireEvent.change(screen.getByLabelText("Jumlah"), { target: { value: "30001" } });
    click("Simpan refund");
    expect(await screen.findByText(/tidak melebihi sisa/)).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Jumlah"), { target: { value: "Rp 30.000" } });
    click("Simpan refund");
    await waitFor(() => expect(api.callLedger).toHaveBeenCalled());
    expect(lastCall()[0]).toBe("post_refund");
    expect(lastCall()[1]).toMatchObject({ p_refund_of_id: "t1", p_amount: "30000" });
    expect(lastCall()[1]).not.toHaveProperty("p_account_id");
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("sends the refund account only when it differs", async () => {
    renderActions(row({}));
    click("Refund");
    await screen.findByRole("option", { name: "Kas" });
    fireEvent.change(screen.getByLabelText("Uang kembali ke akun"), { target: { value: "kas" } });
    click("Simpan refund");
    await waitFor(() => expect(lastCall()[1]).toMatchObject({ p_account_id: "kas", p_amount: "50000" }));
  });

  it("edit sends only the fields that changed", async () => {
    renderActions(row({}));
    click("Ubah");
    await screen.findByRole("option", { name: "Hiburan" });
    fireEvent.change(screen.getByLabelText("Kategori"), { target: { value: "fun" } });
    fireEvent.change(screen.getByLabelText("Catatan (opsional)"), { target: { value: "" } });
    click("Simpan perubahan");
    await waitFor(() => expect(api.callLedger).toHaveBeenCalled());
    expect(lastCall()).toEqual(["edit_transaction", expect.objectContaining({ p_transaction_id: "t1", p_category_id: "fun", p_note: "" })]);
    expect(Object.keys(lastCall()[1]).sort()).toEqual(["p_category_id", "p_idempotency_key", "p_note", "p_transaction_id", "p_workspace_id"]);
  });

  it("makes the user pick a refund account when the original one is archived", async () => {
    renderActions(row({ account_id: "old" }));
    click("Refund");
    await screen.findByRole("option", { name: "Kas" });
    click("Simpan refund");
    expect(await screen.findByText("Pilih akun.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
  });

  it("locks amount and date where an edit would be wrong or refused", () => {
    renderActions(row({ kind: "opening_balance", category_id: null }));
    click("Ubah");
    expect(screen.queryByLabelText("Jumlah")).toBeNull();
    expect(screen.getByLabelText("Tanggal")).toBeInTheDocument();
    cleanup();
    renderActions(row({ refunded_amount: "1000" }));
    click("Ubah");
    expect(screen.queryByLabelText("Jumlah")).toBeNull();
    expect(screen.queryByLabelText("Tanggal")).toBeNull();
  });

  it("edit with no changes just closes", () => {
    renderActions(row({}));
    click("Ubah");
    click("Simpan perubahan");
    expect(api.callLedger).not.toHaveBeenCalled();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("reverses with a reason and shows a server refusal", async () => {
    renderActions(row({ kind: "income", category_id: "salary" }));
    vi.mocked(api.callLedger).mockRejectedValueOnce({ code: "P0001", message: "POSTED_ENTRY_IMMUTABLE" });
    click("Batalkan");
    fireEvent.change(screen.getByLabelText("Alasan (opsional)"), { target: { value: " salah input " } });
    click("Ya, batalkan");
    expect(await screen.findByRole("alert")).toHaveTextContent("Transaksi ini sudah dibatalkan.");
    expect(lastCall()).toEqual(["reverse_transaction", expect.objectContaining({ p_transaction_id: "t1", p_reason: "salah input" })]);
  });
});
