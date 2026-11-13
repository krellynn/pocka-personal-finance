# ADR-008 — Financial Account Archiving

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security · Financial calculations

## Context

Users close bank accounts and stop using wallets. Hard-deleting an account with history would break journal entries, reports, and the audit trail.

## Decision

- Financial accounts with **posted journal entries are never hard-deleted.** They are **archived/deactivated**.
- Archiving preserves historical financial records, posted journal entries, and audit history.
- **Archived accounts cannot be used for new transactions.**
- Historical reports continue to include valid historical records from archived accounts.
- Financial corrections use **reversal or adjustment**, never deletion.
- **Draft** records that were never posted may be deleted under separate rules, as long as no financial history is lost.

## Account lifecycle

```
active ──archive──► archived ──(unarchive, Proposed)──► active
   │
   └── delete ── allowed only if the account has NO journal lines (never used)
```

## Rationale

The ledger is immutable and must stay complete. Archiving gives users a tidy UI without corrupting history.

## Consequences

- An account with a non-zero balance should be brought to zero (via transfer or adjustment) before archiving. Whether archiving with a non-zero balance is blocked or only warned requires design review.
- The same principle applies to categories, income sources, pockets, and debts with history: archive, never delete.
- Database-level protection (FK `RESTRICT` plus a guard against deleting accounts with lines) backs the UI.

## Implementation implications

- `archived_at` on accounts; posting functions reject archived accounts.
- Whether unarchiving is allowed requires design review.
- Whole-user/workspace data deletion requests (e.g. account closure for privacy reasons) are a separate topic requiring design review and product-owner approval. This ADR does not authorise hard-deleting posted history.

## References

[DATABASE_SPECIFICATION §3.3, §5](../DATABASE_SPECIFICATION.md) · [ARCHITECTURE §4.3](../ARCHITECTURE.md) · ADR-004
