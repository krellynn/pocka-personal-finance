import type { QueryClient } from "@tanstack/react-query";
// Query keys per workspace. Postings invalidate the accounts, feed, periodTotals, pockets, budgets and goals prefixes.
export const financeKeys = {
  workspace: (userId: string | undefined) => ["workspace", userId] as const,
  accounts: (workspaceId: string) => ["accounts", workspaceId] as const,
  categories: (workspaceId: string) => ["categories", workspaceId] as const,
  feed: (workspaceId: string) => ["feed", workspaceId] as const,
  periodTotals: (workspaceId: string) => ["periodTotals", workspaceId] as const,
  pockets: (workspaceId: string) => ["pockets", workspaceId] as const,
  budgets: (workspaceId: string) => ["budgets", workspaceId] as const,
  goals: (workspaceId: string) => ["goals", workspaceId] as const,
};

/** After any posting, reversal or edit: balances, the list, the totals and eligible funds may all have changed. */
export const invalidateLedger = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all(
    [financeKeys.accounts(workspaceId), financeKeys.feed(workspaceId), financeKeys.periodTotals(workspaceId), financeKeys.pockets(workspaceId), financeKeys.budgets(workspaceId), financeKeys.goals(workspaceId)].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
