const knownCodes: Record<string, string> = {
  VALIDATION_FAILED: "finance.errors.validation",
  RESOURCE_ARCHIVED: "finance.errors.archived",
  RESOURCE_HAS_BALANCE: "finance.errors.hasBalance",
  CURRENCY_NOT_SUPPORTED: "finance.errors.currencyNotSupported",
  REFUND_EXCEEDS_ORIGINAL: "finance.errors.refundExceeds",
  HAS_DEPENDENT_REFUNDS: "finance.errors.hasRefunds",
  POSTED_ENTRY_IMMUTABLE: "finance.errors.alreadyReversed",
  IDEMPOTENCY_CONFLICT: "finance.errors.alreadyProcessed",
  WORKSPACE_ACCESS_DENIED: "finance.errors.forbidden",
  AUTH_REQUIRED: "auth.errors.sessionExpired",
};

/** The ledger RPCs raise their business error code as the message with SQLSTATE P0001. */
export function isLedgerRejection(error: unknown): error is { code: "P0001"; message: string } {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "P0001" &&
    "message" in error && typeof error.message === "string"
  );
}

/** Maps a ledger RPC error to an i18n key; never surfaces raw server text. */
export function financeErrorKey(error: unknown): string {
  return isLedgerRejection(error) && Object.hasOwn(knownCodes, error.message)
    ? (knownCodes[error.message] as string)
    : "finance.errors.generic";
}

/** create_* RPCs report a duplicate name as VALIDATION_FAILED with the fixed detail "name taken". */
export const nameTakenOr = (error: unknown, nameTakenKey: string) =>
  typeof error === "object" && error !== null && "details" in error && error.details === "name taken"
    ? nameTakenKey
    : financeErrorKey(error);
