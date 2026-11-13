# POCKA — Architecture Decision Register

**This is the authoritative index of approved POCKA architecture decisions.**
An APPROVED decision may only be changed by explicit product-owner approval, recorded as a new ADR that supersedes the old one. AI agents must not silently override any entry (see [DEVELOPMENT_GUIDELINES §10](DEVELOPMENT_GUIDELINES.md)).

Impact columns: **DB** = database design · **App** = application behaviour · **Sec** = security · **Fin** = financial calculations.

---

## 1. V1 Architecture Decisions (ADR-001 to ADR-013)

All approved by the product owner on 2026-11-13.

| ID | Title | Status | DB | App | Sec | Fin |
|---|---|---|:-:|:-:|:-:|:-:|
| [ADR-001](decisions/ADR-001-monetary-storage.md) | Monetary Storage and Precision | APPROVED | ✓ | ✓ | | ✓ |
| [ADR-002](decisions/ADR-002-workspace-level-pockets.md) | Workspace-Level Pocket Architecture | APPROVED | ✓ | ✓ | | ✓ |
| [ADR-003](decisions/ADR-003-shared-summary-policy.md) | Shared Summary Privacy Policy | APPROVED | ✓ | ✓ | ✓ | |
| [ADR-004](decisions/ADR-004-recurring-confirmation.md) | Recurring Transaction Confirmation | APPROVED | ✓ | ✓ | | ✓ |
| [ADR-005](decisions/ADR-005-household-contribution-accounting.md) | Household Contribution Accounting | APPROVED | ✓ | ✓ | ✓ | ✓ |
| [ADR-006](decisions/ADR-006-fx-recognition.md) | Foreign Exchange Recognition Policy | APPROVED | ✓ | | | ✓ |
| [ADR-007](decisions/ADR-007-credit-card-liability.md) | Credit Card Liability Model | APPROVED | ✓ | ✓ | | ✓ |
| [ADR-008](decisions/ADR-008-account-archiving.md) | Financial Account Archiving | APPROVED | ✓ | ✓ | ✓ | ✓ |
| [ADR-009](decisions/ADR-009-household-membership-exit.md) | Household Membership Exit | APPROVED | ✓ | ✓ | ✓ | ✓ |
| [ADR-010](decisions/ADR-010-expense-split-methods.md) | Household Expense Split Methods | APPROVED | ✓ | ✓ | | ✓ |
| [ADR-011](decisions/ADR-011-ui-localization.md) | UI Localization Policy | APPROVED | | ✓ | | |
| [ADR-012](decisions/ADR-012-prototype-preservation.md) | Prototype Preservation and Relocation | APPROVED | | ✓ | | |
| [ADR-013](decisions/ADR-013-household-privacy-invariants.md) | Household Sharing and Privacy Invariants | APPROVED | ✓ | ✓ | ✓ | |

---

## 2. Decision Summaries

### ADR-001 — Monetary Storage and Precision
- **Scope:** All money across DB, APIs, frontend, imports, reports.
- **Decision:** `BIGINT` integer minor units for amounts and balances. `NUMERIC` for FX rates, ratios, percentages, and decimal calculations. Exponent comes from currency metadata (IDR 0, USD 2, JPY 0). No JS floating point for money.
- **Rationale:** Exact, fast, and supports any currency exponent.
- **Consequences:** Central conversion and rounding helpers, half-even rounding, and safe-integer validation. Large values go over the wire as strings or `bigint`.
- **Docs:** ARCHITECTURE §4.6 · DATABASE_SPECIFICATION §1 · DEVELOPMENT_GUIDELINES §5.

### ADR-002 — Workspace-Level Pocket Architecture
- **Scope:** Pockets, allocations, dashboard figures.
- **Decision:** Pockets belong to a workspace and are virtual allocations of eligible funds. They are not assets, and they create no income, expense, or journal lines. Total allocations must not exceed eligible funds. A mandatory **Unallocated** figure (eligible funds − allocated) is calculated, never stored as an asset.
- **Rationale:** One source of truth (the ledger) and no double counting.
- **Consequences:** Overspending below allocations must be shown. Eligibility rules require design review.
- **Docs:** ARCHITECTURE §4.4 · DATABASE_SPECIFICATION §3.5.

### ADR-003 — Shared Summary Privacy Policy
- **Scope:** `shared_summary` visibility scope.
- **Decision:** The whitelist is **empty by default**. No automatic sharing of salary, income totals, balances, net worth, or transaction aggregates. Any addition needs explicit product-owner approval.
- **Rationale:** Privacy by default. Aggregates can leak private data.
- **Consequences:** No V1 feature uses shared summaries. Tests assert the whitelist is empty.
- **Docs:** HOUSEHOLD_PRIVACY §2–3, §5.

### ADR-004 — Recurring Transaction Confirmation
- **Scope:** Recurring income and expenses.
- **Decision:** Due occurrences create **drafts**. The user confirms them before posting. No auto-posting in V1. Execution is idempotent per `(rule, occurrence date)`.
- **Rationale:** Only confirmed facts enter the ledger.
- **Consequences:** Drafts never affect balances or reports. Missed runs back-fill drafts. Skips are recorded. Failures are isolated and retried.
- **Docs:** ARCHITECTURE §6 · DATABASE_SPECIFICATION §3.8.

### ADR-005 — Household Contribution Accounting
- **Scope:** Contributions and direct payments across personal and household workspaces.
- **Decision:** Two distinct intents. **Contribution**: personal expense (Household Contribution category), no receivable; household funding on actual transfer; commitments are not cash. **Reimbursable advance**: personal receivable from household (not an expense); household expense plus payable to member. Reimbursement clears both. No second expense. Partial payments and reimbursements are supported.
- **Rationale:** Each workspace's books are correct, with no double counting.
- **Consequences:** Paired cross-workspace entries, linked privately. Per-member reconciliation of receivable vs. payable.
- **Docs:** HOUSEHOLD_PRIVACY §6–7 · ARCHITECTURE §4.2.

### ADR-006 — Foreign Exchange Recognition Policy
- **Scope:** Multi-currency postings, conversions, settlements.
- **Decision:** Recognise **realized** FX gain/loss on actual conversion or settlement. **No unrealized revaluation** in the V1 ledger. Store original amount and currency, rate snapshot, base amount, and conversion details. Never recalculate history.
- **Rationale:** Real gains and losses are reported without the complexity of revaluation.
- **Consequences:** Foreign accounts need a carrying-value basis. The method requires design review.
- **Docs:** ARCHITECTURE §4.5 · DATABASE_SPECIFICATION §3.2.

### ADR-007 — Credit Card Liability Model
- **Scope:** Credit cards.
- **Decision:** A credit card is a liability account. Purchase: Dr Expense / Cr Card Liability. Bill payment: Dr Card Liability / Cr Bank, **never a second expense**. Statement cycles, rewards, and similar features are out of V1.
- **Rationale:** The expense is recognised once, at purchase.
- **Consequences:** `credit_card` account kind on a liability ledger account. Purchases, liability, and payments are reported separately.
- **Docs:** ARCHITECTURE §4.2 · DATABASE_SPECIFICATION §3.3.

### ADR-008 — Financial Account Archiving
- **Scope:** Accounts (and, by the same principle, other records with posted history).
- **Decision:** Accounts with posted journal entries are **archived, never hard-deleted**. Archived accounts accept no new transactions and remain in historical reports. Corrections use reversal or adjustment. Never-posted drafts may be deleted.
- **Rationale:** An immutable, complete ledger and audit trail.
- **Consequences:** DB-level delete guards. Archive with non-zero balance and unarchive rules require design review.
- **Docs:** DATABASE_SPECIFICATION §3.3, §5.

### ADR-009 — Household Membership Exit
- **Scope:** Members leaving or being removed from a household.
- **Decision:** Access is revoked immediately and status becomes `left`/`removed`. History, contributions, receivables, payables, and settlements are all preserved. Nothing is deleted and nothing private is exposed. Obligations survive the exit.
- **Rationale:** Household books stay complete. Obligations are independent of membership.
- **Consequences:** Settlement with departed members remains possible. A scoped settlement view requires design review.
- **Docs:** HOUSEHOLD_PRIVACY §4.

### ADR-010 — Household Expense Split Methods
- **Scope:** Shared expense splits.
- **Decision:** Equal, fixed amount, percentage (sum exactly 100), and weighted shares, with explicit participant inclusion/exclusion. Σ shares = total. Deterministic **largest-remainder** rounding, with ties broken by participant order.
- **Rationale:** Integer-exact, reproducible, nothing lost.
- **Consequences:** Method, inputs, and results are stored for explainability.
- **Docs:** HOUSEHOLD_PRIVACY §7 · DEVELOPMENT_GUIDELINES §5.

### ADR-011 — UI Localization Policy
- **Scope:** All user-facing text and formatting.
- **Decision:** Default **Bahasa Indonesia**, `id-ID`, IDR, Asia/Jakarta. English is a planned additional language. Centralised i18n and formatting. No hardcoded strings. Date-only values are distinct from timestamps.
- **Rationale:** Serves the target audience and makes future languages cheap.
- **Consequences:** Message catalogues from Phase 0B. The i18n library requires design review.
- **Docs:** PRODUCT_OVERVIEW §6 · DEVELOPMENT_GUIDELINES §4, §6.

### ADR-012 — Prototype Preservation and Relocation
- **Scope:** `index.html` prototype.
- **Decision:** Preserve it. **When the Vite foundation is introduced**, move it to `prototype/index.html` unchanged. Never delete it. Never mix it with production code. **Not moved yet.**
- **Rationale:** Avoids a collision with Vite's root `index.html` and keeps the UX reference.
- **Consequences:** Use `git mv` for the move. Exclude it from the production build.
- **Docs:** PROJECT_STATUS §3–4 · README · ROADMAP.

### ADR-013 — Household Sharing and Privacy Invariants
- **Scope:** Entire household access model.
- **Decision:** Ownership, membership, visibility, and contribution are separate. Private data stays private. Contributions and expenses are shared. Roles never override privacy. Sharing only through whitelisted projections. Immediate revocation. No inference. Enforcement in RLS and server functions.
- **Rationale:** Household features depend on trust.
- **Consequences:** Privacy acceptance tests P1–P20 (HOUSEHOLD_PRIVACY §9) gate every household release.
- **Docs:** HOUSEHOLD_PRIVACY · ARCHITECTURE §5 · DATABASE_SPECIFICATION §6.

---

## 3. Baseline Decisions (from Project Context v1.0, Approved)

These foundational decisions predate the ADR series and remain approved. They use `BL-` IDs so they don't collide with ADR numbers. (Earlier drafts of ARCHITECTURE.md labelled them ADR-01…ADR-12; those labels are retired.)

| ID | Decision | Status |
|---|---|---|
| BL-01 | Unified workspaces (personal + household) on one financial engine | Approved |
| BL-02 | Double-entry ledger; posted entries immutable; corrections by reversal | Approved |
| BL-03 | Supabase/PostgreSQL with RLS as the security boundary | Approved |
| BL-04 | React + TypeScript + Vite SPA, hosted on Vercel; GitHub for source control | Approved |
| BL-05 | Pockets are allocations, not assets (detailed by ADR-002) | Approved |
| BL-06 | Multi-currency with stored FX snapshots (detailed by ADR-006) | Approved |
| BL-07 | Household privacy: salary and balances private; contributions and expenses shared (detailed by ADR-013) | Approved |
| BL-08 | Supabase region Singapore | Approved (provisional; re-evaluate before production) |
| BL-09 | Soft Minimalist Fintech design, light default, dark supported, approved palette | Approved |

## 4. Proposed (not yet approved) Architecture Directions

These are recommendations, **not** decisions. Each needs approval before implementation.

| Ref | Proposal |
|---|---|
| P-01 | All balance-affecting mutations only via Postgres RPC functions (no direct client writes to ledger tables) |
| P-02 | Household roles `owner`, `admin`, `editor`, `viewer` |
| P-03 | Table consolidations listed in DATABASE_SPECIFICATION §4 |
| P-04 | Balance caches start as views; materialise only when needed |

## 5. Change Process

1. Raise the conflict or need, explaining why an approved decision blocks the work.
2. Propose the smallest change.
3. Get explicit product-owner approval.
4. Add a new ADR (next free number) marked as superseding the old one, and update this register and the affected docs.
