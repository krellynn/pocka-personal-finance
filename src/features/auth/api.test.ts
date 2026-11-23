import { describe, expect, it, vi } from "vitest";
import { supabase } from "../../lib/supabase/client";
import { signOut } from "./api";

vi.mock("../../lib/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));

describe("signOut", () => {
  it("falls back to a local sign-out when the server call fails", async () => {
    vi.mocked(supabase.auth.signOut)
      .mockResolvedValueOnce({ error: new Error("offline") } as never)
      .mockResolvedValueOnce({ error: null });
    await signOut();
    expect(supabase.auth.signOut).toHaveBeenNthCalledWith(2, { scope: "local" });
  });
});
