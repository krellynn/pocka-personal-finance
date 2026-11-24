import type { QueryClient } from "@tanstack/react-query";
// Query keys per workspace. Postings invalidate the accounts, feed and periodTotals prefixes.
export const financeKeys = {
  workspace: (userId: string | undefined) => ["workspace", userId] as const,
  accounts: (workspaceId: string) => ["accounts", workspaceId] as const,
  categories: (workspaceId: string) => ["categories", workspaceId] as const,
  feed: (workspaceId: string) => ["feed", workspaceId] as const,
  periodTotals: (workspaceId: string) => ["periodTotals", workspaceId] as const,
};

/** After any posting, reversal or edit: balances, the list and the totals may all have changed. */
export const invalidateLedger = (queryClient: QueryClient, workspaceId: string) =>
  Promise.all(
    [financeKeys.accounts(workspaceId), financeKeys.feed(workspaceId), financeKeys.periodTotals(workspaceId)].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
