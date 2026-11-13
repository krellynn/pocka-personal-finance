# ADR-006 — Foreign Exchange Recognition Policy

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Financial calculations

## Context

V1 supports multi-currency accounts and transactions. Exchange rates change over time, so the base-currency value of a foreign balance at posting time differs from its value when it is converted or settled. Full revaluation of open balances adds significant complexity.

## Decision

- **Realized FX gain/loss is recognised** when an actual conversion or settlement produces a difference between **carrying value** (base amount recorded when the foreign amount entered the books) and **settlement value** (base amount at conversion/settlement).
- **Unrealized FX revaluation is not required** in the V1 ledger.
- Historical transactions retain **original currency, original amount, exchange-rate snapshot (rate, source, timestamp), base-currency amount**, and relevant conversion or settlement details.
- Historical values are **never** recalculated with current rates.

## Value definitions

| Term | Meaning |
|---|---|
| Original transaction value | Amount in the transaction's own currency, as it happened |
| Base-currency reporting value | Original × rate snapshot at posting, stored and frozen |
| Realized FX gain/loss | Settlement value − carrying value, posted to an FX gain or FX loss ledger account when conversion/settlement occurs |
| Unrealized FX (future) | Revaluation of open foreign balances at a current rate. **Not in V1.** Reports may *display* an indicative current-rate value, clearly labelled, without posting it |

Example: buy USD 100 at 15.500 (carrying Rp1.550.000). Later convert USD 100 to IDR receiving Rp1.600.000. Entry: Dr IDR Bank 1.600.000 · Cr USD Account 1.550.000 · Cr Realized FX Gain 50.000.

## Rationale

Realized gains and losses are real money and must be reported. Unrealized revaluation is deferred to keep V1 correct and simple without falsifying history.

## Consequences

- Foreign-currency asset accounts need a carrying-value basis so the realized difference can be computed.
- Rounding differences at conversion are posted to an FX-rounding account and are distinct from gain/loss.
- Applies equally to cross-currency household settlements (ADR-005).

## Implementation implications (require design review)

- Carrying-value method for partial conversions (e.g. weighted average vs. specific lots).
- FX-rate source, refresh cadence, and manual override rules.
- No FX engine in the current phase.

## References

[ARCHITECTURE §4.5](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §3.2](../DATABASE_SPECIFICATION.md) · ADR-001
