# ADR-010 — Household Expense Split Methods

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Financial calculations

## Context

Households split shared costs in different ways. Splitting integer minor-unit amounts produces remainders, for example Rp100.000 ÷ 3. Lost or unexplained remainders break reconciliation.

## Decision

V1 supports four split methods:

1. **Equal**: total divided equally among included participants.
2. **Fixed amount**: each participant's share is entered explicitly.
3. **Percentage**: each participant's percentage is entered.
4. **Weighted shares**: each participant has a weight (e.g. 2:1:1).

Participants can be **explicitly included or excluded** for each expense.

## Calculation and validation rules

- **Always:** Σ participant shares (minor units) **= expense total** exactly. No remainder may be lost.
- **Fixed:** entered amounts must sum exactly to the total. Otherwise validation fails, with no auto-adjustment.
- **Percentage:** percentages (NUMERIC) must sum to **exactly 100**. Monetary shares are then derived as for weighted shares, with weight = percentage.
- **Equal:** weight = 1 for every included participant.
- **Weighted:** weights are positive. Monetary shares are derived deterministically:
  1. For each participant, raw = total × weight / Σ weights (exact rational arithmetic).
  2. Base share = floor(raw) in minor units.
  3. Remainder R = total − Σ base shares (0 ≤ R < number of participants).
  4. **Largest-remainder rule:** give +1 minor unit to the R participants with the largest fractional parts. **Ties break by participant order in the split** (the order stored with the split), so the result is reproducible.
- Excluded participants receive 0 and are not counted in the divisor.
- Every share ≥ 0. At least one participant is included.

Example: Rp100.000 equal among A, B, C → 33.334 / 33.333 / 33.333 (A gets the 1-rupiah remainder by order).

## Rationale

These rules are deterministic, auditable, and integer-exact (ADR-001). Every rupiah is accounted for, and the same input always yields the same result.

## Consequences

- The method, inputs (percentages and weights), and resulting minor-unit shares are all stored, so splits can be explained later.
- Split results drive member obligations (receivables and payables) when a payer covers more than their share.

## Implementation implications

- The calculation runs in the database or in a shared, tested function. The frontend may preview using the same algorithm with `bigint`.
- Percentage input precision (e.g. NUMERIC with up to 4 decimals) requires design review.
- No split engine in the current phase.

## References

[HOUSEHOLD_PRIVACY §7](../HOUSEHOLD_PRIVACY.md) · [DATABASE_SPECIFICATION §3.10](../DATABASE_SPECIFICATION.md) · [DEVELOPMENT_GUIDELINES §5](../DEVELOPMENT_GUIDELINES.md) · ADR-001
