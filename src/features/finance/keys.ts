// Query keys per workspace. Postings invalidate the accounts, feed and periodTotals prefixes.
export const financeKeys = {
  workspace: (userId: string | undefined) => ["workspace", userId] as const,
  accounts: (workspaceId: string) => ["accounts", workspaceId] as const,
  categories: (workspaceId: string) => ["categories", workspaceId] as const,
  feed: (workspaceId: string) => ["feed", workspaceId] as const,
  periodTotals: (workspaceId: string) => ["periodTotals", workspaceId] as const,
};
