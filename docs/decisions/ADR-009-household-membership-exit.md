# ADR-009 — Household Membership Exit

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Security · Financial calculations

## Context

Households change: housemates move out and couples separate. A departure must not erase money owed, and must not expose anyone's private data.

## Decision

When a member leaves (or is removed):

1. Their access to the household workspace is **revoked immediately**.
2. Membership status changes to a **non-active state** (`left`, or `removed` when an admin removes them).
3. Household **transaction history is preserved**.
4. **Contribution records are preserved.**
5. **Outstanding receivables and payables are preserved.**
6. **Settlement history is preserved.**
7. **No historical financial records are deleted.**
8. **No private personal records are exposed** during or after the exit.

A departure **never erases financial obligations**. Outstanding settlements remain available to authorised household administrators and the relevant parties, according to the privacy policy.

## Rationale

The household's books must stay complete and correct. Obligations exist independently of membership.

## Consequences

- RLS grants access only to `status = active` members, so the leaver loses household visibility at once.
- The leaver's own personal workspace still shows their side of any open obligation (e.g. *Receivable from Household*, per ADR-005).
- Remaining members still see the departed member's name on historical records and open payables or receivables.
- Settling with a departed member is still possible and is recorded by an authorised household member.

## Implementation implications (require design review)

- How a departed member views or confirms settlements of their open obligations without regaining general household access (e.g. a narrowly scoped settlement view).
- Profile display for departed members (name retained on history).
- Ownership transfer when the last owner leaves.
- No implementation in the current phase.

## References

[HOUSEHOLD_PRIVACY §4](../HOUSEHOLD_PRIVACY.md) · ADR-005, ADR-013
