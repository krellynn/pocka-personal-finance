# ADR-002 — Workspace-Level Pocket Architecture

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Financial calculations

## Context

Pockets let users express intent ("rent", "emergency fund"). If pockets were modelled as accounts or assets, net worth would be double-counted and transfers between pockets could look like income or expense. Tying pockets to specific accounts also complicates users who spread one purpose across several wallets.

## Decision

- Pockets are **workspace-level virtual allocations**. A pocket belongs to a workspace, not to a financial account.
- Pockets allocate **eligible funds** drawn from the workspace's financial accounts.
- Pocket balances are virtual. They are **not assets**, and they **never** create income, expense, or journal lines. This includes pocket-to-pocket transfers.
- Pocket balances must reconcile with their allocation records.
- **Total allocations must not exceed eligible available funds.**
- **Account balances remain the source of actual financial balances.**
- A mandatory **"Unallocated" balance** (UI: *Belum dialokasikan*) is always shown. It is a calculated figure, **not** an asset and **not** an account.

## Relationship

```
Workspace funds (actual)  = Σ balances of eligible financial accounts      ← from ledger
Allocated                 = Σ pocket balances                               ← from pocket_allocations
Unallocated               = Workspace eligible funds − Allocated            ← calculated, never stored as an asset
Net worth                 = assets − liabilities                            ← pockets play no part
```

## Rationale

This keeps one source of truth (the ledger) and lets pockets be pure intent, which prevents double counting. Unallocated makes every rupiah visible, matching the product tagline.

## Consequences

- Allocating, spending "from" a pocket, or moving between pockets changes only allocation records.
- When real spending lowers account balances below total allocations, the overspent condition must be **shown**, never hidden. New allocations are blocked while allocations would exceed eligible funds.

## Implementation implications (require design review)

- The definition of **eligible funds**: which account kinds are included (e.g. bank, e-wallet, cash), and how credit-card liabilities are treated.
- **Multi-currency** pockets: the currency in which eligible funds and allocations are compared (likely workspace base currency using the latest snapshot for display only).
- How a pocket deficit is presented and resolved.
- No implementation in the current phase.

## References

[ARCHITECTURE §4.4](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §3.5](../DATABASE_SPECIFICATION.md) · ADR-001, ADR-007
