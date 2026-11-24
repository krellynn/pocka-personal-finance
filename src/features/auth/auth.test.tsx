import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import * as api from "./api";
import { SignInPage, UpdatePasswordPage } from "./AuthPages";
import { AuthProvider } from "./AuthProvider";
import { GuestOnly, RequireAuth } from "./guards";

vi.mock("./api", () => ({
  onAuthChange: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  requestPasswordReset: vi.fn(),
  updatePassword: vi.fn(),
  fetchProfile: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const fakeSession = { user: { id: "u1" } } as Session;

type Emit = Parameters<Parameters<typeof api.onAuthChange>[0]>;

function renderAt(entry: string | { pathname: string; state: unknown }, session: Session | null, client = new QueryClient()) {
  let emit: (...args: Emit) => void = () => undefined;
  // Simulates INITIAL_SESSION restored from storage; later events go through `emit`.
  vi.mocked(api.onAuthChange).mockImplementation((cb) => {
    emit = cb;
    cb("INITIAL_SESSION", session);
    return () => undefined;
  });
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="sign-in" element={<SignInPage />} />
            </Route>
            <Route path="/update-password" element={<UpdatePasswordPage />} />
            <Route element={<RequireAuth />}>
              <Route path="/" element={<p>protected</p>} />
              <Route path="/reports" element={<p>reports</p>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { emit: (...args: Emit) => act(() => emit(...args)) };
}

describe("auth routing", () => {
  it("sends guests from a protected page to sign-in", async () => {
    renderAt("/", null);
    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();
    expect(screen.queryByText("protected")).not.toBeInTheDocument();
  });

  it("keeps a restored session on the protected page", async () => {
    renderAt("/", fakeSession);
    expect(await screen.findByText("protected")).toBeInTheDocument();
  });

  it("sends signed-in users away from sign-in", async () => {
    renderAt("/sign-in", fakeSession);
    expect(await screen.findByText("protected")).toBeInTheDocument();
  });

  it("returns a signed-in user to the page they came from", async () => {
    renderAt({ pathname: "/sign-in", state: { from: "/reports" } }, fakeSession);
    expect(await screen.findByText("reports")).toBeInTheDocument();
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example"])("ignores unsafe return target %s", async (from) => {
    renderAt({ pathname: "/sign-in", state: { from } }, fakeSession);
    expect(await screen.findByText("protected")).toBeInTheDocument();
  });

  it("clears cached data on sign-out and on a user switch", async () => {
    const client = new QueryClient();
    const { emit } = renderAt("/", fakeSession, client);
    client.setQueryData(["profile", "u1"], { display_name: "Ana" });
    emit("SIGNED_OUT", null);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(await screen.findByRole("heading", { name: "Masuk" })).toBeInTheDocument();

    emit("SIGNED_IN", fakeSession);
    client.setQueryData(["profile", "u1"], { display_name: "Ana" });
    emit("SIGNED_IN", { user: { id: "u2" } } as Session);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
});

describe("SignInPage", () => {
  it("validates input before calling Supabase", async () => {
    renderAt("/sign-in", null);
    fireEvent.click(await screen.findByRole("button", { name: "Masuk" }));
    expect(await screen.findByText("Email wajib diisi.")).toBeInTheDocument();
    expect(api.signIn).not.toHaveBeenCalled();
  });

  it("shows a translated error for wrong credentials", async () => {
    vi.mocked(api.signIn).mockRejectedValueOnce({ code: "invalid_credentials", message: "Invalid login credentials" });
    renderAt("/sign-in", null);
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "ana@test.local" } });
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "salah-sekali" } });
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Email atau kata sandi salah.");
    await waitFor(() => expect(api.signIn).toHaveBeenCalledWith("ana@test.local", "salah-sekali"));
  });
});

describe("UpdatePasswordPage", () => {
  it("shows the invalid-link screen without a session", async () => {
    renderAt("/update-password", null);
    expect(await screen.findByRole("heading", { name: "Tautan tidak berlaku" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Kata sandi baru")).not.toBeInTheDocument();
  });

  it("rejects a password over 72 bytes even when it is under 72 characters", async () => {
    const tooLong = "😀".repeat(19); // 38 characters, 76 bytes
    renderAt("/update-password", fakeSession);
    fireEvent.change(await screen.findByLabelText("Kata sandi baru"), { target: { value: tooLong } });
    fireEvent.change(screen.getByLabelText("Ulangi kata sandi"), { target: { value: tooLong } });
    fireEvent.click(screen.getByRole("button", { name: "Simpan kata sandi" }));
    expect(await screen.findByText("Kata sandi terlalu panjang (maksimal 72 byte).")).toBeInTheDocument();
    expect(api.updatePassword).not.toHaveBeenCalled();
  });
});
