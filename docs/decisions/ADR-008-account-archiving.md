# ADR-008 — Financial Account Archiving

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security · Financial calculations

## Context

Users close bank accounts and stop using wallets. Hard-deleting an account with history would break journal entries, reports, and the audit trail.

## Decision

- Financial accounts with **posted journal entries are never hard-deleted.** They are **archived/deactivated**.
- Archiving preserves historical financial records, posted journal entries, and audit history.
- **An account may be archived only when its balance is zero in its own currency.** A nonzero balance must first be settled through a valid transfer or other approved closing transaction; archive must never silently write off or hide the balance.
- **Archived accounts cannot be used for new transactions.**
- Archived accounts are excluded from Total Active Account Balance and current Net Worth. Historical transaction reports continue to include valid historical records from archived accounts.
- Financial corrections use **reversal or adjustment**, never deletion.
- **Draft** records that were never posted may be deleted under separate rules, as long as no financial history is lost.

## Account lifecycle

```
active ──(balance must be zero)──archive──► archived ──(unarchive, Proposed)──► active
   │
   └── delete ── allowed only if the account has NO journal lines (never used)
```

## Rationale

The ledger is immutable and must stay complete. Archiving gives users a tidy UI without corrupting history.

## Consequences

- **Approved by D-14 (2026-11-21):** archiving with a nonzero balance is blocked. The user must first settle the balance through a valid transfer or other approved closing transaction.
- Archived accounts are excluded from current active-balance and Net Worth calculations because the zero-balance precondition has been met; their historical posted records remain available for historical reporting.
- The same principle applies to categories, income sources, pockets, and debts with history: archive, never delete.
- Database-level protection (FK `RESTRICT` plus a guard against deleting accounts with lines) backs the UI.

## Implementation implications

- `archived_at` on accounts; posting functions reject archived accounts.
- Unarchive/reactivation permissions and flow remain subject to separate design review.
- Whole-user/workspace data deletion requests (e.g. account closure for privacy reasons) are a separate topic requiring design review and product-owner approval. This ADR does not authorise hard-deleting posted history.

## References

[DATABASE_SPECIFICATION §3.3, §5](../DATABASE_SPECIFICATION.md) · [ARCHITECTURE §4.3](../ARCHITECTURE.md) · ADR-004
