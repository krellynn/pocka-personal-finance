# ADR-007 — Credit Card Liability Model

**Status:** Approved (2026-11-13, product owner)
**Affects:** Database design · Application behaviour · Financial calculations

## Context

Many users spend with credit cards. A common error in finance apps is counting both the card purchase and the card bill payment as expenses.

## Decision

- **Basic credit card support is in V1.** A credit card is a **liability account**.
- Purchase of Rp1.000.000: **Dr** Expense · **Cr** Credit Card Liability
- Paying the bill: **Dr** Credit Card Liability · **Cr** Bank Account
- **Paying the bill is never a second expense.** It is a liability settlement.
- Card purchases, the outstanding liability, and card payments are tracked and reported separately.
- **Out of V1 scope** unless separately approved: statement cycles, complex billing schedules, minimum-payment logic, reward points, and other advanced features.

## Rationale

The expense is recognised once, at the purchase, which is when it happens. The liability correctly reduces net worth until paid.

## Consequences

- Credit cards appear as financial accounts of kind `credit_card` backed by a **liability** ledger account. Their balance is shown as amount owed.
- Interest and fees charged by the card issuer are expenses when posted (consistent with debt rules).
- Refunds to the card reduce the liability and offset the original expense.
- Credit card balances reduce net worth. Treatment in pocket "eligible funds" requires design review (ADR-002).

## Implementation implications

- `financial_accounts.kind` includes `credit_card`; its `ledger_account` has type `liability`, subtype `credit_card`.
- Bill payment is a transfer-type transaction (asset → liability), never an expense.
- No implementation in the current phase.

## References

[ARCHITECTURE §4.2](../ARCHITECTURE.md) · [DATABASE_SPECIFICATION §3.3](../DATABASE_SPECIFICATION.md) · ADR-002
