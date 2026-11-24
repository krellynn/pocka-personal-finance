// @vitest-environment node
// Two sessions at once against the local Supabase stack: every RPC call is its own PostgREST request,
// so Promise.all runs them in separate database transactions. Skipped when the stack is not running.
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../lib/supabase/database.types";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const isLocal = !!url && !!key && /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(url);
const isUp = isLocal && (await fetch(`${url}/auth/v1/health`, { headers: { apikey: key as string } }).then((r) => r.ok, () => false));

const ROUNDS = 5;
const db = createClient<Database>(url ?? "http://localhost", key ?? "x", { auth: { persistSession: false, autoRefreshToken: false } });
let ws = "";
let expenseCategory = "";
let incomeCategory = "";
const newKey = () => crypto.randomUUID();

async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(fn as never, args as never);
  return { data: data as Record<string, unknown> | null, code: error?.message ?? null };
}

async function account(opening = "0") {
  const r = await rpc("create_financial_account", {
    p_workspace_id: ws, p_idempotency_key: newKey(), p_kind: "bank", p_name: `Akun ${newKey().slice(0, 8)}`, p_opening_balance: opening,
  });
  expect(r.code).toBeNull();
  return r.data!.financial_account_id as string;
}

async function balance(accountId: string) {
  const { data } = await db.from("account_balances").select("balance, archived_at").eq("id", accountId).single();
  return data!;
}

describe.skipIf(!isUp)("ledger RPCs under two concurrent sessions", () => {
  beforeAll(async () => {
    const { error } = await db.auth.signUp({ email: `race-${newKey()}@test.local`, password: "Test-pass-123" });
    if (error) throw error;
    ws = (await db.from("workspaces").select("id").single()).data!.id;
    const { data: cats } = await db.from("transaction_categories").select("id, kind");
    expenseCategory = cats!.find((c) => c.kind === "expense")!.id;
    incomeCategory = cats!.find((c) => c.kind === "income")!.id;
  });

  it("the same idempotency key sent twice at once posts once", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const acc = await account();
      const args = { p_workspace_id: ws, p_idempotency_key: newKey(), p_account_id: acc, p_category_id: incomeCategory, p_amount: "1000" };
      const [a, b] = await Promise.all([rpc("post_income", args), rpc("post_income", args)]);
      expect([a.code, b.code]).toEqual([null, null]);
      expect(a.data!.transaction_id).toBe(b.data!.transaction_id);
      expect([a.data!.replayed, b.data!.replayed].sort()).toEqual([false, true]);
      expect((await balance(acc)).balance).toBe("1000");
    }
  });

  it("two refunds that together exceed the expense: only one lands", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const acc = await account("100000");
      const exp = await rpc("post_expense", { p_workspace_id: ws, p_idempotency_key: newKey(), p_account_id: acc, p_category_id: expenseCategory, p_amount: "50000" });
      const refund = () => rpc("post_refund", { p_workspace_id: ws, p_idempotency_key: newKey(), p_refund_of_id: exp.data!.transaction_id, p_amount: "30000" });
      const codes = (await Promise.all([refund(), refund()])).map((r) => r.code).sort();
      expect(codes).toEqual(["REFUND_EXCEEDS_ORIGINAL", null].sort());
      expect((await balance(acc)).balance).toBe("80000");
    }
  });

  it("archive and post at once never leave an archived account with a balance", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const acc = await account();
      const [arch, post] = await Promise.all([
        rpc("set_financial_account_archived", { p_workspace_id: ws, p_account_id: acc, p_archived: true }),
        rpc("post_income", { p_workspace_id: ws, p_idempotency_key: newKey(), p_account_id: acc, p_category_id: incomeCategory, p_amount: "500" }),
      ]);
      // Exactly one wins; the loser gets the matching business error.
      expect([arch.code, post.code].filter((c) => c === null)).toHaveLength(1);
      expect(arch.code ?? post.code).toMatch(/^(RESOURCE_HAS_BALANCE|RESOURCE_ARCHIVED)$/);
      const b = await balance(acc);
      expect(b).toMatchObject(post.code === null ? { balance: "500", archived_at: null } : { balance: "0" });
      expect(b.archived_at === null).toBe(post.code === null);
    }
  });

  it("reversing the same transaction twice at once reverses it once", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      const acc = await account("10000");
      const exp = await rpc("post_expense", { p_workspace_id: ws, p_idempotency_key: newKey(), p_account_id: acc, p_category_id: expenseCategory, p_amount: "4000" });
      const reverse = () => rpc("reverse_transaction", { p_workspace_id: ws, p_idempotency_key: newKey(), p_transaction_id: exp.data!.transaction_id });
      const codes = (await Promise.all([reverse(), reverse()])).map((r) => r.code).sort();
      expect(codes).toEqual(["POSTED_ENTRY_IMMUTABLE", null].sort());
      expect((await balance(acc)).balance).toBe("10000");
    }
  });

  it("two allocations that together exceed eligible funds: only one lands", async () => {
    for (let i = 0; i < ROUNDS; i++) {
      // Park whatever is unallocated in a filler pocket, then add exactly 60.000 of eligible funds.
      const unallocated = BigInt((await db.from("pocket_summary").select("unallocated").eq("workspace_id", ws).single()).data!.unallocated!);
      const filler = (await rpc("create_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_name: `Filler ${newKey().slice(0, 8)}` })).data!.pocket_id;
      if (unallocated > 0n) {
        expect((await rpc("allocate_to_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: filler, p_amount: unallocated.toString() })).code).toBeNull();
      }
      await account("60000");
      const pocket = (await rpc("create_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_name: `Pocket ${newKey().slice(0, 8)}` })).data!.pocket_id;
      const allocate = () => rpc("allocate_to_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: pocket, p_amount: "40000" });
      const codes = (await Promise.all([allocate(), allocate()])).map((r) => r.code).sort();
      expect(codes).toEqual(["ALLOCATION_EXCEEDS_ELIGIBLE", null].sort());
      const { data } = await db.from("pocket_summary").select("unallocated").eq("workspace_id", ws).single();
      expect(BigInt(data!.unallocated!)).toBeGreaterThanOrEqual(0n);
      // Empty the pocket so the next round starts from the same position.
      await rpc("deallocate_from_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: pocket, p_amount: "40000" });
    }
  });

  it("two moves draining the same pocket: one fails, nothing goes negative", async () => {
    await account("100000");
    const mk = async () => (await rpc("create_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_name: `P ${newKey().slice(0, 8)}` })).data!.pocket_id as string;
    for (let i = 0; i < ROUNDS; i++) {
      const [a, b, c] = [await mk(), await mk(), await mk()];
      expect((await rpc("allocate_to_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: a, p_amount: "30000" })).code).toBeNull();
      const move = (to: string) => rpc("move_between_pockets", { p_workspace_id: ws, p_idempotency_key: newKey(), p_from_pocket_id: a, p_to_pocket_id: to, p_amount: "20000" });
      const codes = (await Promise.all([move(b), move(c)])).map((r) => r.code).sort();
      expect(codes).toEqual(["POCKET_INSUFFICIENT", null].sort());
      const { data } = await db.from("pocket_balances").select("balance").eq("id", a).single();
      expect(data!.balance).toBe("10000");
      await rpc("deallocate_from_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: a, p_amount: "10000" });
      for (const p of [b, c]) {
        const bal = (await db.from("pocket_balances").select("balance").eq("id", p).single()).data!.balance!;
        if (bal !== "0") await rpc("deallocate_from_pocket", { p_workspace_id: ws, p_idempotency_key: newKey(), p_pocket_id: p, p_amount: bal });
      }
    }
  });
});
