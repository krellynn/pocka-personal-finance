// @vitest-environment node
// Runs against the local Supabase stack (npx supabase start); skipped when it is not configured.
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const isLocal = !!url && !!key && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
// Skip (not fail) when the local stack is configured but stopped.
const isUp = isLocal && (await fetch(`${url}/auth/v1/health`, { headers: { apikey: key as string } }).then((r) => r.ok, () => false));

const newClient = () =>
  createClient<Database>(url as string, key as string, { auth: { persistSession: false, autoRefreshToken: false } });

async function signedUpUser(label: string) {
  const client = newClient();
  const email = `${label}-${crypto.randomUUID()}@test.local`;
  const { data, error } = await client.auth.signUp({ email, password: "Test-pass-123", options: { data: { display_name: label } } });
  if (error) throw error;
  return { client, email, userId: data.user!.id };
}

describe.skipIf(!isUp)("auth + RLS against local Supabase", () => {
  it("provisions one personal workspace and isolates two users", async () => {
    const ana = await signedUpUser("Ana");
    const budi = await signedUpUser("Budi");

    const { data: anaProfile } = await ana.client.from("profiles").select("id, display_name");
    expect(anaProfile).toEqual([{ id: ana.userId, display_name: "Ana" }]);

    const { data: anaWorkspaces } = await ana.client.from("workspaces").select("id, workspace_type, base_currency, timezone, locale");
    expect(anaWorkspaces).toHaveLength(1);
    expect(anaWorkspaces![0]).toMatchObject({ workspace_type: "personal", base_currency: "IDR", timezone: "Asia/Jakarta", locale: "id-ID" });

    const { data: budiWorkspaces } = await budi.client.from("workspaces").select("id");
    const budiWorkspaceId = budiWorkspaces![0]!.id;

    // Guessed IDs: reads return nothing, writes touch nothing.
    expect((await ana.client.from("workspaces").select("id").eq("id", budiWorkspaceId)).data).toEqual([]);
    expect((await ana.client.from("profiles").select("id").eq("id", budi.userId)).data).toEqual([]);
    expect((await ana.client.from("workspaces").update({ name: "x" }).eq("id", budiWorkspaceId).select()).data).toEqual([]);
    expect((await ana.client.from("user_settings").select("user_id")).data).toEqual([{ user_id: ana.userId }]);

    // Session restore: signing in again yields the same user; sign-out removes access.
    const again = newClient();
    const { data: signIn, error } = await again.auth.signInWithPassword({ email: ana.email, password: "Test-pass-123" });
    expect(error).toBeNull();
    expect(signIn.user?.id).toBe(ana.userId);
    await again.auth.signOut();
    expect((await again.from("profiles").select("id")).error?.code).toBe("42501");
  });

  it("rejects a duplicate sign-up without creating a second workspace", async () => {
    const ana = await signedUpUser("Retry");
    const { error } = await newClient().auth.signUp({ email: ana.email, password: "Test-pass-123" });
    expect(error?.code).toBe("user_already_exists");
    expect((await ana.client.from("workspaces").select("id")).data).toHaveLength(1);
  });
});
