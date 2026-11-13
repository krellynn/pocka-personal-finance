# ADR-011 — UI Localization Policy

**Status:** Approved (2026-11-13, product owner)
**Affects:** Application behaviour

## Context

The primary audience is Indonesian. The prototype mixes English and Indonesian labels. Adding languages later is costly if strings are hardcoded.

## Decision

| Setting | Default |
|---|---|
| UI language | **Bahasa Indonesia** |
| Locale | `id-ID` |
| Currency | `IDR` |
| Timezone | `Asia/Jakarta` |

- The app is designed for **additional languages**. **English is a planned additional language**, not part of the V1 default.
- **Centralised localisation and formatting** architecture. User-facing strings are **never hardcoded** across components.
- Financial date handling distinguishes **local date-only values** from **timestamps**.

## Rationale

Indonesian first serves the target audience. A central i18n layer makes English, and other languages later, a translation task rather than a rewrite.

## Consequences

- All copy lives in message catalogues keyed by ID. Formatting uses central helpers driven by locale (`formatCurrency`, `formatDate`, …).
- Code identifiers, comments, and technical docs remain in English.
- Categories seeded by the system have localisable names.

## Implementation implications

- The i18n library choice requires design review.
- Date-only values as `YYYY-MM-DD` / Postgres `date`; instants as `timestamptz`; never derive local dates from UTC ISO strings.

## References

[PRODUCT_OVERVIEW §6](../PRODUCT_OVERVIEW.md) · [DEVELOPMENT_GUIDELINES §4, §6](../DEVELOPMENT_GUIDELINES.md)
