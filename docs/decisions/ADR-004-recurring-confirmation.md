# ADR-004 — Recurring Transaction Confirmation

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Financial calculations

## Context

Recurring income and expenses (salary, rent, subscriptions) often change in amount or date. Silently auto-posting them would put unverified figures into the ledger and reports.

## Decision

Recurring rules generate **DRAFT transactions by default**. They **never auto-post** in V1.

1. A schedule reaches its due date.
2. The system generates a **draft** transaction.
3. The user reviews it, optionally edits it, and confirms.
4. The confirmed transaction is **posted** through the normal posting path.
5. Ledger and balances update.

- Drafts **do not** affect posted balances, budgets, or reports.
- Execution is **idempotent**: one execution per `(rule, occurrence date)`, so retries never create duplicate drafts.
- Optional auto-posting is a **possible future capability**, not part of V1.

## Rationale

Users keep control ("Money, in your control."), the ledger only contains confirmed facts, and the scheduler stays simple.

## Consequences

- **Missed schedules:** if the scheduler was down, the next run generates drafts for all missed occurrences up to today, each with its own idempotent occurrence key. Nothing is skipped silently.
- **Skipped occurrences:** the user can mark an occurrence as skipped. It is recorded, never posted, and never regenerated.
- **Paused/cancelled rules:** generate nothing while paused; cancelled rules stop permanently. History is preserved.
- **Partial failures:** a failure for one occurrence or rule is recorded (`failed`, with error and attempt count) and retried without affecting others. Draft generation and execution-record update happen atomically.
- Stale drafts stay as drafts until the user confirms, edits, or discards them.
- Discarding a draft is allowed, because drafts carry no financial history (ADR-008).

## Implementation implications

- `recurring_executions` unique `(rule_id, occurrence_date)`; statuses `pending | drafted | posted | skipped | failed`.
- Occurrence dates are computed in the workspace timezone.
- Notification of new drafts (in-app) is proposed. The channel requires design review.
- No implementation in the current phase.

## References

[ARCHITECTURE §6](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §3.8](../DATABASE_SPECIFICATION.md) · ADR-008
