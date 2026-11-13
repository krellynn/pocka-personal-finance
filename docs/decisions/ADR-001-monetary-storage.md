# ADR-001 — Monetary Storage and Precision

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Financial calculations

## Context

POCKA is multi-currency, and its currencies have different decimal exponents (IDR 0, USD 2, JPY 0). Binary floating point (JS `number`, Postgres `float`) cannot represent many decimal amounts exactly, and it loses integer precision above 2^53 − 1. Financial balances must reconcile exactly to the ledger.

## Decision

- **Monetary amounts and balances** are stored as **`BIGINT` integer minor units** everywhere: database, APIs, imports, reports, calculations.
- **PostgreSQL `NUMERIC`** is used for exchange rates, decimal ratios, percentages, and intermediate calculations that need decimal precision.
- Currency metadata (`currencies.minor_units`) defines each currency's decimal exponent. **No code may assume two decimal places.**
- JavaScript floating-point arithmetic is **never** used for money.

## Rationale

Integers are exact, fast, and simple to sum and compare. Keeping the exponent in metadata supports 0-, 2- and 3-decimal currencies without schema changes. `NUMERIC` keeps rates and ratios exact where integers cannot.

## Consequences

- Every amount travels with its currency code, and the two are never separated.
- Display requires `amount_minor / 10^exponent`, formatted by the central helpers. For example, IDR `12850000` displays as `Rp12.850.000`, and USD `1050` displays as `US$10,50` in id-ID formatting.
- Any conversion back to minor units goes through one rounding point with a documented rounding mode.
- Postgres `bigint` (max ≈ 9.22 × 10^18) exceeds JS `Number.MAX_SAFE_INTEGER` (≈ 9.007 × 10^15). The frontend must use `bigint` or strings and must not rely on JSON numbers for large values.

## Implementation implications

- Central helpers: `toMinorUnits(input, currency)`, `fromMinorUnits(minor, currency)`, `convertMinor(amountMinor, rate, fromCurrency, toCurrency)`, `allocateMinor(total, weights)`. All are unit-tested.
- Rounding: deterministic. **Half-even (banker's rounding)** at the single conversion point. Allocation remainders follow ADR-010's rule.
- Boundaries: input validation rejects values outside the configured maximum. API payloads carry amounts as **strings** (or numbers proven ≤ `MAX_SAFE_INTEGER`). The exact wire format is an implementation detail requiring design review.
- Exchange rates use `NUMERIC(20,10)` (Proposed precision; final precision requires design review).

## References

[ARCHITECTURE §4.6](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §1](../DATABASE_SPECIFICATION.md) · [DEVELOPMENT_GUIDELINES §5](../DEVELOPMENT_GUIDELINES.md) · ADR-006, ADR-010
