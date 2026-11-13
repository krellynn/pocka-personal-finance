# POCKA — Product Overview

Status labels: **Approved** · **Proposed** · **Pending product-owner decision** (see README). Approved architecture decisions: [`DECISION_REGISTER.md`](DECISION_REGISTER.md).

---

## 1. Identity (Approved)

| | |
|---|---|
| Name | POCKA |
| Tagline | "Money, in your control." |
| Category | Personal Finance Management App |
| Audience | Young adults, approx. 18–30+, with room for household use |
| Personality | Youthful, playful, trustworthy, clean, sleek, practical |
| Name origin | From "pocket": organising money into purposeful allocations |

## 2. Vision (Approved)

Build a clear, trustworthy, easy-to-use personal finance app. Users should be able to see **where their money is, where it goes, what it is allocated for, and how their position changes over time**.

## 3. Product Principles (Approved)

1. **Financial correctness:** numbers must reconcile. A wrong balance is a critical bug.
2. **Privacy and data security:** private data stays private, including inside households.
3. **Clear financial information:** plain language and no misleading totals (e.g. pockets never inflate net worth).
4. **Simple, intuitive UX:** common tasks (add a transaction, check a balance) take seconds.
5. **Modular, extensible architecture:** modules ship incrementally on a shared engine.
6. **Avoid unnecessary complexity:** build only confirmed V1 needs.

## 4. Target Users

- **Individual (primary):** a young professional, freelancer, or student who wants to track spending, budget, save toward goals, and manage installments (*cicilan*), often with several e-wallets and bank accounts.
- **Household member:** partners, family members, or housemates who split shared costs and contribute to shared funds **without revealing salaries or personal balances** to each other.

## 5. Modules

| # | Module | Purpose | V1 scope notes |
|---|---|---|---|
| 1 | Dashboard | At-a-glance balances, cash flow, budget progress, recent activity | Uses compact currency on cards only |
| 2 | Transactions | Income, expense, transfer, refund, adjustment | Manual entry + import; posted entries immutable, corrections by reversal |
| 3 | Accounts / Wallets | Where money exists: bank, e-wallet, cash; plus credit cards | **Basic credit cards as liability accounts** (ADR-007); statement cycles and rewards out of V1. Used accounts are **archived, never deleted** (ADR-008). Loans are tracked via Debt |
| 4 | Pockets | Workspace-level virtual allocations ("Food money", "Emergency fund") | Not assets; never added to net worth. Mandatory **Unallocated** (*Belum dialokasikan*) figure (ADR-002) |
| 5 | Income management | Multiple income sources (employer, client, business) | Source ≠ category |
| 6 | Categories | Income/expense classification | System defaults + user-defined (Proposed) |
| 7 | Budgets | Planned spending per category and period vs. actuals | Refunds offset actuals |
| 8 | Financial goals | Savings targets, milestones | May link to a pocket; contributions are allocations, not expenses |
| 9 | Debt & installments | Loans, installment plans, payments | Principal and interest separated |
| 10 | Recurring transactions | Scheduled income and expenses | Generates **drafts** the user confirms; no auto-post in V1 (ADR-004). Idempotent; skip, pause, cancel |
| 11 | Reports & analytics | Cash flow, net worth, budget vs. actual, goal and debt status | Household reports exclude private data |
| 12 | Multi-currency | Accounts and transactions in non-base currencies | Historical FX snapshots never recalculated; realized FX gain/loss only; no unrealized revaluation in V1 (ADR-006) |
| 13 | Household workspace | Shared expenses, contributions, settlements | Splits: equal, fixed, percentage, weighted (ADR-010). Contribution vs. reimbursable advance (ADR-005). Exit preserves obligations (ADR-009). Privacy rules in `HOUSEHOLD_PRIVACY.md` (ADR-013, ADR-003) |
| 14 | Notifications | Bill reminders, budget alerts, recurring drafts, household requests | Channel (in-app/email/push): Pending |
| 15 | Settings & profile | Profile, locale, currency, theme, members/roles, audit history | |
| 16 | Import & reconciliation | CSV/file import with staged review; matching against existing records | Never auto-posts unreviewed rows |

Authentication (Supabase Auth) is a foundational capability underlying modules 13 and 15.

## 6. UX Direction

### Visual style (Approved): Soft Minimalist Fintech

- **Light mode default**; dark mode supported. No navy/dark default background.
- Generous whitespace and clear hierarchy.
- Moderate rounded corners, subtle borders and shadows.
- Modern typography; **Lucide** icons.
- Responsive for desktop and mobile.

### Palette (Approved)

| Role | Hex |
|---|---|
| Background | `#F4F6F2` |
| Surface / card | `#FFFFFF` |
| Primary text | `#172D45` |
| Secondary text | `#64766C` |
| Primary accent: sage | `#9BCDB6` |
| Secondary accent: soft blue | `#9BC5F5` |
| Highlight: soft yellow | `#F6D58A` |

Target balance: about 70% light neutral, 20% white surfaces, 10% accents. Positive/negative financial colours must be accessible (WCAG AA contrast). The exact hex values are **Pending** design-token definition. The dark-mode palette is **Pending**.

> The current `index.html` prototype uses an older lime/green palette. The approved palette above supersedes it.

### Localisation (Approved: [ADR-011](decisions/ADR-011-ui-localization.md))

**UI language Bahasa Indonesia**, locale `id-ID`, currency `IDR`, timezone `Asia/Jakarta`. English is a planned additional language. Strings and formatting are centralised.

| Item | Format |
|---|---|
| Currency | `Rp12.850.000` (no space, `.` thousands, `,` decimal, no decimals for IDR) |
| Signed | `+Rp850.000` income, `−Rp85.000` expense |
| Compact (cards and charts only) | `Rp850 rb`, `Rp1,5 jt`, `Rp12,85 jt`, `Rp1,25 M` |
| Percentage | `75,5%` |
| Date | `02 Nov 2026` or `02/11/2026` |
| Time | 24-hour, `14:30` |
| Month | `November 2026` |

Full amounts are always used in forms, transaction details, records, and exports. Amounts are stored as integer minor units and formatted only for display (ADR-001).

### Tone

Friendly and encouraging ("Every rupiah has a place."), never judgmental, and never at the expense of precision in financial figures.

## 7. Product Boundaries (what POCKA is not)

- **Not a bank or payment app.** POCKA does not hold or move money.
- **No bank credentials.** It never collects PINs, banking passwords, or OTPs. Bank linking via aggregators is out of scope for V1 (Pending for later).
- **No investment advice.** Investment and asset tracking beyond basic assets is out of V1 scope (Pending).
- **Not a tax or accounting product** for businesses, although it uses double-entry internally.
- **No fake data in real accounts.** Demo and seed data are separated from real user data.
- **Household is not surveillance.** Admins cannot see members' private finances, and nothing personal is shared as a summary by default (ADR-003, ADR-013).

### V1 vs. future enhancements

| In V1 (Approved) | Future, not V1 (requires separate approval) |
|---|---|
| Recurring drafts with confirmation | Optional recurring auto-posting |
| Realized FX gain/loss | Unrealized FX revaluation |
| Basic credit cards (purchase, liability, payment) | Statement cycles, billing schedules, reward points |
| Empty `shared_summary` | Any shared-summary field |
| Bahasa Indonesia UI | English and other languages |
