# ADR-013 — Household Sharing and Privacy Invariants

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security

## Context

Personal and household workspaces share one financial engine and often one user. Without strict invariants, a role, a join, or an aggregate could expose a member's private finances to the household.

## Decision (strict invariants)

1. **Ownership, membership, visibility, and contribution are separate concepts.** None implies another.
2. **Private by default:** personal salary/income details, personal account balances, personal transactions, personal assets/liabilities, and personal net worth are **private**.
3. **Shared:** household contributions and household expenses (in full detail) are **shared** with active household members.
4. **Roles never override privacy:** household owner/admin roles grant **no** access to any member's private records.
5. **Controlled projections only:** personal → household information flows only by the member's explicit action, through projections with explicit field whitelists. Source records are never exposed wholesale.
6. **`shared_summary` is empty by default** (ADR-003).
7. **Immediate revocation:** revoking a share removes household access immediately.
8. **No inference:** household views never allow private values to be reconstructed.
9. **Database enforcement:** invariants are enforced by PostgreSQL RLS and server-side functions. The UI is not the security boundary.
10. **Exit safety:** leaving a household revokes access and exposes nothing private (ADR-009).

## Rationale

Trust is the product. Household features are useful only if members are sure their private finances stay private.

## Consequences

- Every household feature must pass the privacy acceptance tests (HOUSEHOLD_PRIVACY §9) before release.
- Facts already posted to the household ledger are household records, not projections, so revoking a projection does not erase them. The UI must make this clear before posting.
- Any change to these invariants requires explicit product-owner approval and a superseding ADR.

## Implementation implications

- RLS helper functions (`is_active_member`, `can_view_record`, …) and per-table policies, each covered by automated tests.
- No foreign key from household data to personal records that a household member's query could follow.

## References

[HOUSEHOLD_PRIVACY](../HOUSEHOLD_PRIVACY.md) · [ARCHITECTURE §5](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §6](../DATABASE_SPECIFICATION.md) · ADR-003, ADR-005, ADR-009
