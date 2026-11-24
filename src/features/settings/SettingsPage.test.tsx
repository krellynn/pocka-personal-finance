import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "../auth/api";
import { SettingsPage } from "./SettingsPage";

vi.mock("../auth/api", () => ({ fetchProfile: vi.fn(), updateDisplayName: vi.fn() }));
vi.mock("../auth/useAuth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, loading: false }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPage() {
  vi.mocked(api.fetchProfile).mockResolvedValue({ display_name: "Ana", avatar_url: null });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SettingsPage />
    </QueryClientProvider>,
  );
  return screen.findByDisplayValue("Ana");
}

describe("SettingsPage", () => {
  it("saves a trimmed display name and refetches the profile", async () => {
    vi.mocked(api.updateDisplayName).mockResolvedValue();
    const input = await renderPage();
    fireEvent.change(input, { target: { value: "  Ana B  " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(await screen.findByText("Perubahan tersimpan.")).toHaveAttribute("role", "status");
    expect(api.updateDisplayName).toHaveBeenCalledWith("u1", "Ana B");
    expect(input).toHaveValue("Ana B");
    await waitFor(() => expect(api.fetchProfile).toHaveBeenCalledTimes(2));
  });

  it("rejects an empty name without calling Supabase", async () => {
    const input = await renderPage();
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(await screen.findByText("Nama tampilan wajib diisi.")).toBeInTheDocument();
    expect(api.updateDisplayName).not.toHaveBeenCalled();
  });

  it("shows an error when saving fails", async () => {
    vi.mocked(api.updateDisplayName).mockRejectedValue(new Error("offline"));
    const input = await renderPage();
    fireEvent.change(input, { target: { value: "Ana C" } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan perubahan" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Gagal menyimpan. Coba lagi.");
  });
});
