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
