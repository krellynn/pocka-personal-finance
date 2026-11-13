# ADR-003 — Shared Summary Privacy Policy

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security

## Context

The `shared_summary` visibility scope was defined to allow limited, aggregate information to flow from a member's personal finances into a household. Even aggregates (e.g. "total income this month") can reveal salary or net worth. The question of which fields qualify was left open.

## Decision

- The **`shared_summary` whitelist is EMPTY by default** in V1.
- No personal financial field is automatically allowed. Specifically, there is **no automatic** sharing of salary, income totals, personal account balances, net worth, or aggregates of personal transactions.
- **Adding any field** to the shared-summary whitelist requires **explicit product-owner approval** and a new or amended ADR.
- Any future sharing uses controlled projections and explicit field whitelists (ADR-013).

## Rationale

This is privacy by default. An empty whitelist cannot leak, and every exception becomes a deliberate, reviewed decision.

## Consequences

- The scope exists in the schema and RLS model, but no V1 feature writes to it.
- Household reports and dashboards cannot depend on any personal summary data.
- Tests must assert that no `shared_summary` projection contains any personal financial field.

## Implementation implications

- The field whitelist is defined in a single reviewed location (code constant plus database check). It ships empty for `shared_summary`.
- An attempt to create a `shared_summary` projection with any field is rejected.

## References

[HOUSEHOLD_PRIVACY §2–3, §5](../HOUSEHOLD_PRIVACY.md) · ADR-013
