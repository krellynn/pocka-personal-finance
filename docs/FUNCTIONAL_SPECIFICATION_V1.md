# POCKA V1 — Functional Specification

**Status:** Proposed detailed implementation specification; approved product decisions remain governed by ADRs.  
**Scope:** V1 functional behaviour and acceptance criteria.  
**No implementation:** This document defines expected behaviour; it is not code or a database migration.

## 1. Common interaction requirements

Every feature must provide appropriate:
- Loading, empty, populated, success, validation, permission-denied and recoverable-error states.
- Confirmation before irreversible or consequential actions.
- Clear distinction between draft and posted financial records.
- Full-precision amounts in forms/details; compact currency only in constrained dashboard/chart contexts.
- Bahasa Indonesia UI by default, centralised through i18n.
- Keyboard-operable controls, labelled fields, visible focus and accessible contrast.
- Server/database authorization independent of UI visibility.

Every workspace-scoped operation must validate active membership and relevant role. Client-side hiding is never an authorization boundary.

## 2. Identity, authentication and profile

### Capabilities
- Email-based sign-up, sign-in, sign-out and password reset through Supabase Auth.
- Session restoration and protected application routes.
- Profile display name and optional avatar.
- User settings: theme, locale, default workspace and notification preferences where supported.
- Create/enter a personal workspace after registration (automatic creation is Proposed and requires approval).

### Acceptance criteria
- A signed-out user cannot access authenticated routes or private data.
- A signed-in user can restore a valid session after refresh.
- Sign-out clears the local session and protected views.
- Password-reset flow does not reveal whether an arbitrary email is registered.
- User A cannot read or update User B's profile/settings.
- A new account cannot be considered onboarded until required profile/workspace state exists.
- No provider beyond email is added without product-owner approval.

## 3. Workspace and membership

### Capabilities
- Personal workspace and household workspace types on the same financial engine.
- Workspace selector for users belonging to multiple workspaces.
- Workspace name, base currency, timezone and locale settings.
- Membership roles proposed as owner, admin, editor, viewer; exact permission matrix must be approved before implementation.
- Invitation lifecycle: create, accept, expire, revoke; tokens stored hashed.
- Membership exit/removal revokes access immediately while preserving financial history and obligations (ADR-009).

### Acceptance criteria
- All workspace data is scoped to the active workspace and validated in the database.
- A member cannot access another workspace by changing an ID in a URL or request.
- A household owner/admin cannot read another member's private personal financial records.
- Last-owner protection prevents a household from becoming ownerless.
- Leaving/removal immediately blocks new reads/writes according to privacy rules, without deleting history or obligations.
- Invitations cannot be reused after expiry, acceptance or revocation.

## 4. Accounts and wallets

### Capabilities
- Create and manage bank, e-wallet, cash and basic credit-card accounts.
- Account name, type, currency, opening balance, optional institution/notes and status.
- Account list, detail, balance and transaction history.
- Archive/unarchive behaviour subject to approved rules.
- Credit cards represented as liability accounts; statement cycles/rewards excluded from V1 (ADR-007).

### Acceptance criteria
- Opening balances create auditable balanced journal entries.
- Account balance reconciles to ledger lines, not client-side arithmetic.
- Accounts with posted history cannot be hard-deleted. Archiving is blocked while the account has a nonzero balance; the balance must first be settled through a valid transfer or approved closing transaction.
- Archived accounts reject new postings and are excluded from Total Active Account Balance and current Net Worth, while historical transactions remain visible in historical reports.
- Accounts with posted history cannot be hard-deleted (ADR-008).
- Credit-card purchases increase liability and recognize expense once; bill payment reduces liability and bank balance without a second expense.
- Cross-currency account operations use approved FX posting rules.

## 5. Transactions and ledger

### Supported transaction classes
- Income.
- Expense.
- Transfer between owned accounts.
- Refund linked to original expense where possible.
- Adjustment.
- Reversal and repost correction flow.
- Credit-card purchase/payment patterns.
- Debt disbursement and repayment patterns.
- Household contribution and reimbursable advance patterns under their own workflows.

### Acceptance criteria
- Every posted journal entry has total debits equal to total credits.
- Posted journal entries and their lines are immutable.
- A correction creates a reversal and, where needed, a replacement posting; no silent edit of posted facts.
- Posting is atomic and idempotent; duplicate request retries do not duplicate financial effects.
- Concurrent posting cannot produce lost updates or inconsistent balances.
- Transfers do not affect income/expense totals.
- Pocket allocations and goal contributions do not create journal entries.
- One original expense may receive multiple linked partial refunds, or one full refund. Each refund offsets the original expense, is not income, and the cumulative successfully posted refund amount cannot exceed the original refundable amount; the remaining refundable amount is recalculated for every refund.
- All referenced account/category/source/workspace IDs belong to the same workspace unless a specifically approved cross-workspace workflow applies.
- Date-only transaction dates are stored as date values and interpreted in workspace timezone.
- Amount entry rejects zero/negative values where prohibited, malformed values, unsupported precision and configured maximum violations.

## 6. Categories and income sources

### Capabilities
- Separate income and expense categories; categories are classification dimensions, not ledger accounts (D-09 approved).
- Multiple income sources (employer, freelance client, business, other).
- System defaults and user-defined categories (user-defined capability is Proposed until final taxonomy review).
- Category/source selection in relevant transaction forms and filters. Category selection is metadata for reporting/budgets and does not select or create a ledger account.

### Acceptance criteria
- Income source is not conflated with income category.
- Expense-only categories cannot be assigned to income and vice versa.
- A source/category must belong to the same workspace or be an approved global reference.
- Historical reports preserve classification snapshots or stable references according to the finalized data contract.

## 7. Pockets and allocations

### Capabilities
- Workspace-level pockets for intended allocation of eligible funds.
- Create, rename, archive and allocate/deallocate.
- Mandatory Unallocated figure.
- Allocation history and overspending visibility.

### Acceptance criteria
- Pockets are not accounts/assets and never change actual cash/account balances.
- Pocket balances are excluded from net worth and income/expense totals.
- Unallocated = eligible funds minus allocated funds, calculated rather than stored as an asset.
- Eligible funds include active cash, bank and e-wallet balances only; positive balances contribute and negative/overdraft balances reduce the aggregate. Exclude credit-card available credit/limits, receivables and archived accounts.
- `Unallocated = eligible funds − total allocated` is derived, not stored, and may become negative after spending or another balance change; display the shortfall clearly.
- Reject new allocations that would increase an existing shortfall or cause total allocations to exceed eligible funds. Deallocation remains allowed during a shortfall; pocket-to-pocket transfers preserve total allocations.
- Serialize allocation validation and writes atomically to prevent concurrent over-allocation.
- Foreign-currency conversion basis/rate and household/private-fund eligibility remain gated by D-18/D-19 and G5 respectively.

## 8. Budgets

### Capabilities
- Monthly budgets and category-level planned amounts.
- Actual spending derived from posted transactions.
- Refunds offset actuals.
- Progress and overspend indicators.

### Acceptance criteria
- Budget actuals reconcile to qualifying ledger-backed expenses.
- Transfers, pocket allocations, loan principal and other excluded financial events do not inflate spending.
- Refunds linked to original expenses reduce the appropriate actuals.
- Period boundaries use workspace timezone and date-only values.
- Budget changes preserve history or audit trail according to the final data contract.

## 9. Financial goals

### Capabilities
- Create goals with target amount, target date, status and optional linked pocket.
- Milestones and progress.
- Contributions/allocations toward a goal.

### Acceptance criteria
- Goal contributions are allocations, not income or expense.
- Goal progress does not inflate assets or net worth.
- Linked pocket amounts are not double-counted.
- Completed, paused and cancelled states are distinguishable.

## 10. Debt and installments

### Capabilities
- Track debt/loan principal, lender, currency, dates, installment plan and status.
- Record disbursement and repayments.
- Allocate each repayment between principal, interest and fee where applicable.
- Show outstanding principal and payment history.

### Acceptance criteria
- Loan proceeds are not earned income.
- Principal repayment reduces liability and cash; it is not an expense category.
- Interest and applicable fees are expenses.
- Payment total equals principal + interest + fee components exactly.
- Outstanding principal reconciles to debt ledger balances.
- A payment whose total exceeds the remaining amount due is rejected (D-17.1 Option A approved 2026-11-21); the excess is not stored as lender credit, a receivable/refundable balance or an expense.
- The remaining amount due must be validated at posting time with concurrency protection so concurrent repayments cannot collectively exceed the obligation.
- Early settlement uses the lender-provided payoff amount; the user records total plus principal, interest and applicable fee/penalty components. POCKA does not invent payoff calculations. After successful full settlement posting, mark the debt settled and stop future installments (D-17.2 Option A approved 2026-11-22).
- Schedule edits affect future unpaid installments only; paid installments, posted payments, journal entries and historical records remain unchanged (D-17.3 Option A approved 2026-11-22). Future schedule changes must be traceable; exact editable fields and detailed interest/fee recalculation rules remain pending under D-17.
- A user may pay less than the scheduled installment amount. POCKA posts the actual amount received, retains the unpaid remainder as outstanding against that installment, and displays **Partially Paid** until it is resolved. The unpaid remainder is never silently treated as paid, waived or deleted. Partial-payment allocation must use the configured lender-backed schedule and D-17.4; no guessed proportional split or assumed component priority is permitted. The exact allocation priority, due-date/late-fee and carry-forward/rescheduling rules remain G2 deliverables (D-17.5 Option A approved 2026-11-22).
- Before confirming a POCKA-estimated payment split, users may edit the estimated principal/interest/fee component amounts. The edited components must reconcile exactly to the applicable lender installment total or actual partial-payment amount. Preserve the original estimate and edited values, label the result **user-adjusted POCKA estimate**, and retain editor/confirmation provenance. This does not allow editing lender-provided component figures. D-17.10 explicit confirmation remains mandatory before posting (D-17.11 Option B approved 2026-11-22); validation and audit details remain G2 deliverables.
- Any POCKA-estimated principal/interest/fee allocation made because lender component details are absent must be shown as a POCKA estimate and explicitly reviewed and confirmed by the user before the payment is posted. Do not auto-post or silently treat confirmation as lender verification. Preserve estimated status/provenance; if the user declines or inputs are insufficient, do not post using the estimate and route to exception/manual reconciliation (D-17.10 Option A approved 2026-11-22). Review UX, confirmation evidence, metadata and RPC details remain G2 deliverables.
- If a revised lender schedule supplies the installment total but omits the principal/interest/fee split, POCKA may estimate the component allocation using the user-supplied/confirmed interest rate and remaining tenor plus recorded outstanding debt data. Clearly label this as a POCKA estimate, never as lender-confirmed, and do not override lender-provided totals or component figures. If required inputs or a reliable basis are missing, require exception/manual reconciliation. The interest method, rate convention, timing, fees, rounding, disclosure and posting treatment remain G2 deliverables (D-17.9 Option B approved 2026-11-22).
- If a revised lender schedule affects an installment that is already partially paid, preserve posted payments and their historical component allocations, and retain the unpaid remainder as outstanding. Do not reset, duplicate or erase the installment/payment. The revised schedule must explicitly reconcile the remainder before new terms are applied; if it does not provide enough information, require a defined exception/manual reconciliation rather than guessing. Preserve traceable links to the original installment and revised schedule (D-17.8 Option A approved 2026-11-22). Detailed reconciliation and component-allocation rules remain G2 deliverables.
- When a lender formally revises a repayment schedule, users provide or import the revised lender schedule. It applies only to unpaid/future installments from its documented effective point. Paid installments, posted payments, journal entries and historical records remain unchanged. Preserve old/new schedule versions, source and effective date for auditability; do not invent lender terms (D-17.7 Option A approved 2026-11-22). Import validation, installment mapping, effective-date rules and partially paid installment handling remain G2 deliverables.
- The lender-provided repayment/amortization schedule is the source of truth for scheduled installment amounts and principal/interest/fee components where supplied. Users provide or import it during debt setup. POCKA follows lender figures rather than independently calculating interest. If the schedule is missing or insufficient to determine a split, do not guess; route the payment through a defined exception/manual reconciliation flow. Schedule import/validation, revisions and partial-payment allocation gaps remain G2 deliverables (D-17.6 Option A approved 2026-11-22).
- For regular scheduled debt installments, users enter one total payment amount only. Debt terms and lender-provided repayment schedule/details are configured during initial debt setup; POCKA automatically allocates each posted payment to principal, interest and fees from that lender-backed configuration. Principal reduces outstanding debt; interest and fees are recorded as expenses. The component split must reconcile exactly to the total. Do not invent a split if the setup/schedule data is insufficient; use a defined exception flow. Early settlement continues to follow the lender-quoted payoff process (D-17.4 Option A approved 2026-11-22; D-17.2 remains applicable to early settlement).


### Debt interaction requirements — D-37
- The default debt journey must be concise and task-oriented; progressive disclosure is used for advanced lender data, schedule changes, estimates, partial-payment reconciliation and exceptions.
- A regular installment payment uses one total payment amount as the primary user input. POCKA applies the approved lender-backed allocation without requiring the user to manually split principal, interest and fees in the ordinary path.
- Debt setup still requires sufficient lender-backed schedule/term information to support correct allocation. If data is unavailable or incomplete, explain the gap and use the approved exception or estimate-review path; do not fabricate a split.
- Estimates, user-adjusted estimates and revised/partially paid schedule handling must follow D-17.6 and D-17.8–D-17.11, including clear provenance and explicit confirmation before posting an estimate.
- Show the installment's total due, amount paid, unpaid remainder and status in plain language. A partial payment remains visibly **Partially Paid** until resolved.
- Advanced details must be available when needed, but must not burden every user with accounting terminology or edge-case controls. Simplicity is a presentation rule, not permission to bypass financial validation or approved accounting behaviour.

## 11. Recurring transactions

### Capabilities
- Recurring income and expense rules with schedule, amount, currency, account, category and metadata.
- Due occurrence generation, missed-run backfill, skip, pause and cancel.
- User review and confirmation before posting.

### Acceptance criteria
- Scheduler creates draft occurrences only (ADR-004).
- Drafts do not affect account balances, cash flow or reports.
- Unique rule/occurrence identity prevents duplicate drafts on retry.
- Failed occurrence processing is isolated and retryable.
- Confirmation invokes the same validated posting flow as a manually entered transaction.

## 12. Multi-currency

### Capabilities
- Workspace base/reporting currency.
- Accounts and transactions may use different currencies.
- Store original currency/amount, FX snapshot, converted base amount, source and timestamp.
- Manual rates and provider-fed rates may be supported after provider decision.
- Realized FX gain/loss on actual conversion/settlement only.

### Acceptance criteria
- Historical posted FX snapshots never change when a rate feed updates.
- Conversion rounding uses half-even once at the defined boundary.
- V1 does not post unrealized revaluation.
- FX gain/loss is recognized only on actual conversion/settlement.
- Foreign-account carrying-value method and rate-provider strategy are approved before implementation.
- Household base currency when members differ remains a blocking product-owner decision for household reporting.

## 13. Dashboard and reports

### Dashboard capabilities
- Account balances.
- Income/expense and cash flow for selected period.
- Budget progress.
- Recent transactions.
- Pocket allocations/Unallocated.
- Goals and upcoming bills where data exists.

### Reports
- Cash flow.
- Income and expense by category/source.
- Budget vs actual.
- Net worth.
- Debt status.
- Household reports with strict privacy filtering.

### Acceptance criteria
- Every displayed financial total reconciles to ledger-derived database results.
- Empty datasets display zero/empty states, never fake fallback values.
- Period filters affect all relevant cards/charts/tables consistently.
- Compact currency appears only in constrained cards/charts; details use full amounts.
- Household reports exclude all private personal financial information and inferential aggregates.
- Charts have accessible text/labels and do not use colour as the only distinction.

## 14. Household contributions, expenses and settlements

### Capabilities
- Household expenses and participant splits: equal, fixed, percentage, weighted (ADR-010).
- Contributions as commitment, actual transfer, or direct household payment.
- Direct payment intent: contribution or reimbursable advance (ADR-005).
- Partial payments, reimbursements and settlements.
- Paired personal/household entries with private linking.
- Membership exit preserving obligations (ADR-009).

### Acceptance criteria
- Commitment is not cash and does not increase household balance.
- Actual transfer changes household cash only when funds actually enter household-owned account.
- Direct payment is not falsely represented as a household cash transfer.
- Contribution intent and reimbursable-advance intent have different accounting treatment.
- Reimbursement clears payable/receivable and does not create a second expense.
- Split outputs sum exactly to the source amount using largest-remainder rounding; tie order is deterministic.
- All privacy acceptance tests P1–P20 in HOUSEHOLD_PRIVACY.md pass before household release.
- Shared summary remains empty; no automatic salary, balance, net worth or transaction aggregate disclosure.

## 15. Import and reconciliation

### Capabilities
- Upload supported CSV/file formats to a staging workflow.
- Parse, map columns, validate and preview rows.
- Detect likely duplicates.
- Allow user correction and selective/partial commit.
- Keep import job history and error details.
- Reconcile imported records with existing transactions.

### Acceptance criteria
- No ambiguous/unreviewed row is silently posted.
- Staging rows are not financial ledger entries.
- Committing uses the same validated, idempotent posting RPCs as manual entry.
- Duplicate detection is explainable and does not silently discard uncertain matches.
- Partial commit reports imported, skipped and failed counts.
- File size/type limits, parser library, retention and Storage access policy are defined before implementation.
- Import cannot bypass workspace RLS or financial invariants.

## 16. Notifications, settings and audit

### Capabilities
- In-app notifications first.
- User preferences, theme, locale, default workspace.
- Audit history for postings, reversals, role changes and sharing grants/revocations.
- Notification channels beyond in-app are pending.

### Acceptance criteria
- Notification content does not expose private financial data to unauthorized users.
- Audit records are append-only and access-controlled.
- User settings are isolated by authenticated user.
- Theme supports light default and dark mode.
- All user-facing strings use central i18n catalogue.

## 17. V1 end-to-end user journeys

At minimum, E2E coverage must include:
1. Sign up → personal workspace → create account → post income → post expense → verify balance and dashboard.
2. Create two accounts → transfer → verify neither income nor expense increases.
3. Create pocket → allocate funds → verify account balance/net worth unchanged.
4. Create budget → post expense/refund → verify actual.
5. Create debt → record repayment split → verify principal and interest.
6. Create recurring rule → generate draft → verify no balance change → confirm → verify one posting.
7. Create foreign-currency account/transaction → verify frozen FX snapshot and base-currency report.
8. Create household → invite member → create shared expense and split → verify each member's allowed view.
9. Create reimbursable advance → reimburse → verify no duplicate expense.
10. Leave/remove household member → verify access revoked and obligations/history preserved.
11. Import CSV → preview → correct duplicate → commit → verify ledger and job summary.
12. Attempt unauthorized cross-workspace/private-data access → verify denial.

## 18. Open details

Do not invent unresolved behaviour. Refer to PRODUCT_OWNER_DECISIONS_V1.md and the implementation design reviews in ARCHITECTURE.md §9.2–9.3. A module may be scaffolded in isolation, but any unresolved decision that changes financial semantics, schema, privacy or user-visible promises blocks final integration.


- If the lender's schedule/terms do not specify the component allocation for a partial installment payment, POCKA must not guess a proportional split or assume a component-priority order. Require the user to reconcile principal, interest and applicable fee amounts using authoritative lender information before posting; the components must be non-negative and sum exactly to the actual payment amount. If the allocation cannot be substantiated, keep the payment unposted and show a clear exception/manual-reconciliation state. Apply D-11 RPC-only posting, D-12 money wire format and concurrency-safe remaining-obligation checks (D-17.12 Option A approved 2026-11-22).
