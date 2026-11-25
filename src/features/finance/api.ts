import { supabase } from "../../lib/supabase/client";

/** The signed-in user's default workspace (not `.single()` on workspaces: a user may join several). */
export async function fetchWorkspace(userId: string) {
  const settings = await supabase.from("user_settings").select("default_workspace_id").eq("user_id", userId).single();
  if (settings.error) throw settings.error;
  const workspaceId = settings.data.default_workspace_id;
  if (!workspaceId) throw new Error("No default workspace");
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, timezone, base_currency")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchAccounts(workspaceId: string) {
  const { data, error } = await supabase
    .from("account_balances")
    .select("id, kind, name, currency, balance, archived_at")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return data;
}

export async function fetchCategories(workspaceId: string) {
  const { data, error } = await supabase
    .from("transaction_categories")
    .select("id, kind, name, archived_at")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return data;
}

type LedgerResult = { transaction_id?: string; financial_account_id?: string; replayed: boolean };

/** Calls a ledger RPC; throws the PostgrestError so callers can map it with financeErrorKey. */
export async function callLedger(fn: string, args: Record<string, unknown>): Promise<LedgerResult> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as unknown as LedgerResult;
}

export const FEED_LIMIT = 100;

/** Transactions in a date range, newest first. shortcut: capped at 100 rows, add paging once a month can exceed it. */
export async function fetchFeed(workspaceId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from("transaction_feed")
    .select("id, kind, occurred_on, amount, note, account_id, account_name, counter_account_name, category_id, category_name, is_reversed, refunded_amount, reverses_id, signed_amount")
    .eq("workspace_id", workspaceId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(0, FEED_LIMIT - 1);
  if (error) throw error;
  return data;
}

export async function fetchPeriodTotals(workspaceId: string, from: string, to: string) {
  const { data, error } = await supabase.rpc("period_totals", { p_workspace_id: workspaceId, p_from: from, p_to: to });
  if (error) throw error;
  return data;
}

export async function fetchPockets(workspaceId: string) {
  const { data, error } = await supabase
    .from("pocket_balances")
    .select("id, name, balance, target_amount, archived_at")
    .eq("workspace_id", workspaceId)
    .order("name");
  if (error) throw error;
  return data;
}

/** Eligible funds, allocated and "Belum dialokasikan" (negative = shortfall, D-16). */
export async function fetchPocketSummary(workspaceId: string) {
  const { data, error } = await supabase
    .from("pocket_summary")
    .select("eligible_funds, allocated, unallocated, is_shortfall")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Rename goes straight to the table: RLS lets writers update only `name`. No row back means no access. */
export async function renamePocket(pocketId: string, name: string) {
  const { data, error } = await supabase.from("pockets").update({ name }).eq("id", pocketId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw { code: "P0001", message: "WORKSPACE_ACCESS_DENIED" };
}

export const MOVEMENTS_LIMIT = 50;

/** Latest pocket movements, newest first; amount cast to text so money never passes through a JS number. */
export async function fetchPocketMovements(workspaceId: string) {
  const { data, error } = await supabase
    .from("pocket_movements")
    .select("id, from_pocket_id, to_pocket_id, amount:amount::text, note, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .range(0, MOVEMENTS_LIMIT - 1);
  if (error) throw error;
  return data;
}

/** Plan vs actual for a "YYYY-MM-01" month; unbudgeted spending comes back with has_budget = false. */
export async function fetchBudgetVsActual(workspaceId: string, month: string) {
  const { data, error } = await supabase.rpc("budget_vs_actual", { p_workspace_id: workspaceId, p_month: month });
  if (error) throw error;
  // Generated types mark every column non-null; planned and remaining are null when has_budget is false.
  return data as (Omit<(typeof data)[number], "planned" | "remaining"> & { planned: string | null; remaining: string | null })[];
}

/** Absolute plan for one category and month; "0" removes it. */
export async function setBudget(workspaceId: string, month: string, categoryId: string, amount: string) {
  const { error } = await supabase.rpc("set_budget", { p_workspace_id: workspaceId, p_month: month, p_category_id: categoryId, p_amount: amount });
  if (error) throw error;
}

export async function copyBudgets(workspaceId: string, fromMonth: string, toMonth: string) {
  const { data, error } = await supabase.rpc("copy_budgets", { p_workspace_id: workspaceId, p_from_month: fromMonth, p_to_month: toMonth });
  if (error) throw error;
  return (data as { copied: number }).copied;
}
