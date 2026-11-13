# ADR-005 — Household Contribution Accounting

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security · Financial calculations

## Context

A member can fund the household in different ways: promise money (commitment), transfer money into a household account, or pay a household expense directly from personal funds. The economic meaning differs. A **contribution** is money given away, while a **reimbursable advance** is money the member expects back. Each event touches two workspaces (personal and household), and they must stay private from each other.

## Decision

Funding intent has exactly two values, which remain distinct throughout the system: **`contribution`** and **`reimbursable_advance`**.

### A. Contribution

| Workspace | Treatment |
|---|---|
| Personal | Personal **expense** in a *Household Contribution* expense category. Reduces personal cash/bank. **No receivable.** |
| Household | Household **funding**. An actual transfer increases the household-owned account balance. A **commitment does not** increase household cash. |

Entries:
- Personal: **Dr** Household Contribution (expense) · **Cr** Personal Bank
- Household, actual transfer: **Dr** Household Bank · **Cr** Member contribution (household funding)
- Household, direct payment of a household expense with intent `contribution`: **Dr** Household Expense · **Cr** Member contribution (household funding). No household cash movement.

### B. Reimbursable advance

| Workspace | Treatment |
|---|---|
| Personal | **Receivable from Household**. **Not** an expense at payment. Reduces personal cash/bank. |
| Household | Recognise the actual **household expense** and a **payable to the member**. |

Entries:

| Event | Personal workspace | Household workspace |
|---|---|---|
| Member pays household expense | Dr Receivable from Household · Cr Personal Bank | Dr Household Expense · Cr Payable to Member |
| Household reimburses member | Dr Personal Bank · Cr Receivable from Household | Dr Payable to Member · Cr Household Bank |

- **Settlement never creates a second expense** and never creates income.
- **Partial payments and partial reimbursements** are supported. Receivable and payable decrease by the amount reimbursed.
- Commitments are tracked separately from actual payments and never post to a ledger.

## Rationale

Each workspace's books are individually correct: the member's net worth reflects money given away versus money owed back, and the household's expense is recognised once. Keeping the intents distinct prevents double counting and mislabelled obligations.

## Consequences

- **Cross-workspace accounting:** one real-world event can produce **two journal entries in two workspaces**, each balanced on its own. They are linked by a cross-workspace event reference that does not expose either side's private data to the other workspace's members.
- **Reconciliation:** for each member, *Receivable from Household* (personal) should equal *Payable to Member* (household) for the same events. Only the member (who can see both) or a server-side job may compare them. Household members never see the personal side.
- If a member records only the household side (e.g. has not set up a personal workspace entry), the household books are still correct. The personal entry is optional but recommended.

## Implementation implications (require design review)

- Ledger account type for household "member contribution" funding (equity-style account proposed).
- Mechanism for creating the paired personal entry (single RPC that writes both, vs. user-confirmed personal draft), and the link-record design.
- Currency handling when personal and household base currencies differ (see ADR-006).
- No implementation in the current phase.

## References

[HOUSEHOLD_PRIVACY §6–7](../HOUSEHOLD_PRIVACY.md) · [ARCHITECTURE §4.2](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §3.10](../DATABASE_SPECIFICATION.md) · ADR-006, ADR-009, ADR-013
