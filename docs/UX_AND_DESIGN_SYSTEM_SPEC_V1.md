# POCKA V1 — UX and Design System Specification

**Status:** Proposed implementation specification based on approved brand and localization decisions.  
**No implementation:** Tokens, components and screens are described here; no app code or visual assets are created by this document.

## 1. UX principles

- Soft Minimalist Fintech: youthful, practical, clean and trustworthy.
- Financial clarity before decoration.
- Light mode default; dark mode supported.
- Responsive desktop and mobile layouts.
- Generous whitespace, clear hierarchy, moderate rounding, subtle borders/shadows.
- Lucide icons only.
- No misleading totals, fake fallback values or ambiguous labels.
- Use colour plus text/signs for financial direction; never colour alone.

## 2. Approved brand tokens

| Semantic role | Approved value |
|---|---|
| Main background | `#F4F6F2` |
| Surface/card | `#FFFFFF` |
| Primary text | `#172D45` |
| Secondary text | `#64766C` |
| Primary accent/sage | `#9BCDB6` |
| Secondary accent/soft blue | `#9BC5F5` |
| Highlight/soft yellow | `#F6D58A` |

The palette is approved. Exact semantic token mapping, dark-mode values, status colours and contrast-safe variants require design review and WCAG AA verification. Do not invent a dark palette and treat it as approved.

## 3. Localization and formatting

Approved defaults:
- UI language: Bahasa Indonesia.
- Locale: `id-ID`.
- Default currency: IDR.
- Timezone: `Asia/Jakarta`.
- Currency format: `Rp12.850.000` (no space after Rp).
- Thousands separator: period; decimal separator: comma.
- IDR display normally has no decimal places.
- Percentage example: `75,5%`.
- Time: 24-hour.
- Date: `02 Nov 2026` or `02/11/2026`.
- Compact currency only in constrained cards/charts (e.g. Rp850 rb, Rp1,5 jt).
- Full values in forms, transaction details, financial records and exports.

All user-facing copy must use central message catalogues. English is not part of V1 unless approved separately.

## 4. Application information architecture

Proposed primary navigation:
1. Dashboard.
2. Transactions.
3. Accounts.
4. Pockets.
5. Budgets.
6. Goals.
7. Debt & installments.
8. Recurring.
9. Reports.
10. Household (visible only when user has household access).
11. Notifications.
12. Settings.

Workspace selector is a global shell control. Navigation labels and grouping may be adjusted during usability review, but module access and privacy must not be implied by navigation visibility.

## 5. Screen inventory and required states

| Screen | Required content | Important states |
|---|---|---|
| Authentication | Sign in, sign up, reset password | validation, loading, generic auth errors |
| Onboarding | Profile and personal workspace | incomplete, success, retry |
| Dashboard | Balances, cash flow, budget, recent activity | empty, loading, error, populated |
| Accounts list/detail | Account type, currency, balance, activity | no accounts, archived, error |
| Transaction list/detail | Date, type, amount, category/source, account, status | filter empty, draft, posted, reversed |
| Transaction form | Type-specific fields, account, category/source, date, note | validation, precision, duplicate submit |
| Pockets | Pocket allocations, Unallocated, history | no pockets, no eligible funds, overspending, negative Unallocated shortfall |
| Budgets | Period, category plan, actual, progress | no budget, overspend, refund adjustment |
| Goals | Target, progress, milestones | no goals, paused, completed |
| Debt | Principal, schedule, payments, interest | no debt, due, overdue, settled |
| Recurring | Rules, upcoming drafts, skipped/paused | no rules, draft pending, retry failure |
| Reports | Date range, cash flow, category/source, net worth | empty period, export, error |
| Household | Members, shared expenses, contributions, settlement | invitation pending, access denied, member left |
| Import | Upload, mapping, preview, review, results | invalid file, duplicates, partial commit |
| Settings | Profile, theme, locale, default workspace | save, validation, permission |


### Debt UX principle — Simple by default, advanced when needed (D-37)
- Make the common debt journey feel straightforward: show the next useful action, a clear total amount, due date/status and remaining amount due; avoid exposing debit/credit, ledger accounts, journal entries or unnecessary accounting terminology.
- Ask only for information needed at the current step. Keep advanced lender terms, amortization/schedule details, component breakdowns, schedule revisions and reconciliation controls in progressive-disclosure sections or focused follow-up steps.
- During debt setup, guide the user to provide or enter the lender-backed repayment schedule required by D-17.6. Do not make the interface imply that POCKA can reliably allocate payments without sufficient source data.
- For a normal scheduled payment, keep the primary action to entering the total amount paid and selecting/confirming the funding account where applicable. Apply the approved lender-backed allocation in the background.
- If lender component data is missing and an estimate is permitted, show the estimate in a focused review step, label it clearly, allow editing only of estimated components, and require explicit confirmation before posting (D-17.9–D-17.11).
- Handle partial payments, revised schedules and partially paid installment reconciliation through contextual explanations and targeted steps only when those situations occur. Preserve posted history and show the unpaid remainder clearly.
- If data is insufficient or inconsistent, explain what is missing and offer a guided exception/manual-reconciliation path. Never guess, silently post, or overwhelm the ordinary journey with every possible edge case.
- Keep the UI simple without weakening validation, idempotency, authorization, auditability or the RPC-only financial mutation boundary.

## 6. Reusable component inventory

### Shell and navigation
- App shell, sidebar, mobile navigation, workspace switcher, page header, breadcrumbs.
- Authenticated and unauthenticated route layouts.

### Data display
- Money display (full/compact variants).
- Account balance card.
- Summary card.
- Transaction row/table.
- Status and category badge.
- Empty state, skeleton, error state.
- Chart frame with text summary and accessible labels.
- Pagination and filters.

### Forms and actions
- Money input with currency precision.
- Date-only picker aware of workspace timezone.
- Account/category/source selectors.
- Transaction-type-specific form sections.
- Confirmation dialog for archive, reverse, leave/remove, and import commit. Account archive must show the current balance and block confirmation while the balance is nonzero, explaining that the user must transfer/settle it first; after archiving, explain that the account is excluded from active-balance and Net Worth totals while history is retained.
- Toast/inline feedback.
- Accessible modal/drawer.

### Privacy and security UX
- Clear private/shared labels where relevant.
- Explicit sharing consent and revoke affordance.
- Do not show private fields with masked placeholders if the user is not authorized; do not fetch them.
- Permission-denied state that does not reveal whether another user's private record exists.

## 7. Responsive behaviour

Proposed breakpoints must be verified in implementation; avoid hard-coding a device-only assumption.

- Mobile: single-column content, bottom navigation or compact navigation, forms in full-width layout, tables transform into readable cards or horizontally scroll with clear labels.
- Tablet: compact sidebar and responsive grid.
- Desktop: full navigation, multi-column dashboard and data tables.
- Charts must remain legible and not become the only way to access data.
- Critical actions remain reachable by keyboard and touch.

## 8. Accessibility requirements

- WCAG AA contrast for text and controls.
- Visible focus and logical focus order.
- Semantic headings and landmarks.
- Every input has a label and useful error association.
- Dialogs trap/restore focus and close predictably.
- Keyboard support for navigation, menus, tables and forms.
- Financial status communicated with labels/signs, not colour alone.
- Charts provide accessible summaries or equivalent data tables.
- Respect reduced-motion preferences.

## 9. Screen acceptance checklist

A screen is ready when:
- It uses approved semantic tokens and central i18n.
- It works at mobile, tablet and desktop widths.
- It has loading, empty, success and failure states.
- It does not render fake financial fallback values.
- It does not calculate authoritative balances in the browser.
- It uses full monetary precision in details and forms.
- It has keyboard and screen-reader-usable controls.
- It exposes only data authorized by the database/API.
- It passes relevant visual and E2E regression tests.

## 10. Design review backlog

Before implementation:
- Define semantic light/dark CSS variables from approved palette.
- Verify contrast for positive, negative, warning, destructive and disabled states.
- Confirm navigation grouping and mobile navigation pattern.
- Confirm component density and data-table strategy.
- Select and document typography and spacing scale.
- Review transaction form flows for each transaction class.
- Confirm household private/shared visual cues.
- Review charts and report data accessibility.

Do not treat the current static prototype's palette, labels, hard-coded values or fake balances as design authority. Preserve the prototype unchanged at `prototype/index.html` when the Vite foundation is introduced (ADR-012).


### Pocket shortfall behaviour — D-16
- Show the eligible-funds source basis clearly: active cash, bank and e-wallet accounts; exclude credit-card available credit, receivables and archived accounts.
- Negative/overdraft balances reduce eligible funds.
- If spending or another balance change makes Unallocated negative, show the negative amount as a clear shortfall state; do not hide or clamp it to zero.
- Disable/reject new allocations that would increase the shortfall. Keep deallocation available; pocket-to-pocket transfers must not increase total allocations.
- For foreign-currency accounts, do not present an unapproved conversion basis/rate; FX behaviour remains gated by D-18/D-19.


### Partial debt payment exception UX — D-17.12
- If lender data does not define how a partial payment is allocated, do not guess or auto-split it.
- Ask the user to reconcile the principal, interest and fee components using authoritative lender information in a focused exception step.
- Do not post until the allocation is complete, valid and reconciles exactly to the actual payment amount.
- If the user cannot substantiate the split, keep the payment unposted and explain what information is needed; do not make the normal repayment flow more complex for users whose lender schedule already defines the allocation.
