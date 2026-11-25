import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { PocketFundsForm } from "./PocketFundsForm";

vi.mock("./api", () => ({ callLedger: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const pockets = [
  { id: "p1", name: "Darurat", balance: "100000" },
  { id: "p2", name: "Liburan", balance: "0" },
];
function renderForm() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <PocketFundsForm workspaceId="w1" pockets={pockets} />
    </QueryClientProvider>,
  );
}
const set = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const submit = () => fireEvent.click(screen.getByRole("button", { name: "Simpan" }));

describe("PocketFundsForm", () => {
  it("allocates with a digit-string amount", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderForm();
    set("Pocket", "p2");
    set("Jumlah", "Rp 250.000");
    set("Catatan (opsional)", "  gaji  ");
    submit();
    expect(await screen.findByText("Dana pocket diperbarui.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("allocate_to_pocket", expect.objectContaining({ p_workspace_id: "w1", p_pocket_id: "p2", p_amount: "250000", p_note: "gaji" }));
  });

  it("moves between two different pockets and rejects the same pocket", async () => {
    vi.mocked(api.callLedger).mockResolvedValue({ replayed: false });
    renderForm();
    set("Aksi", "move");
    set("Dari pocket", "p1");
    set("Ke pocket", "p1");
    set("Jumlah", "1000");
    submit();
    expect(await screen.findByText("Pilih pocket tujuan yang berbeda.")).toBeInTheDocument();
    expect(api.callLedger).not.toHaveBeenCalled();
    set("Ke pocket", "p2");
    submit();
    expect(await screen.findByText("Dana pocket diperbarui.")).toBeInTheDocument();
    expect(api.callLedger).toHaveBeenCalledWith("move_between_pockets", expect.objectContaining({ p_from_pocket_id: "p1", p_to_pocket_id: "p2", p_amount: "1000", p_note: null }));
  });

  it("shows the server reason when an allocation exceeds unallocated funds", async () => {
    vi.mocked(api.callLedger).mockRejectedValue({ code: "P0001", message: "ALLOCATION_EXCEEDS_ELIGIBLE" });
    renderForm();
    set("Pocket", "p1");
    set("Jumlah", "999999");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("melebihi dana yang belum dialokasikan");
  });
});
