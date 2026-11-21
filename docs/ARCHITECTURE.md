# POCKA — Architecture

Status labels: **Approved** · **Proposed** · **Pending product-owner decision**.

This document describes the **target** architecture. None of it is implemented yet (see `PROJECT_STATUS.md`).

Approved decisions are indexed in [`DECISION_REGISTER.md`](DECISION_REGISTER.md) (ADR-001 to ADR-014, plus baseline decisions BL-01 to BL-09; BL-04's hosting choice is superseded by ADR-014). Where this document and an ADR differ, **the ADR governs**. Report the discrepancy so it can be fixed.

---

## 1. System Overview

```
┌──────────────────────────────┐      served by      ┌──────────────────────────────┐
│ Browser                      │ ◄────────────────── │ Cloudflare Workers           │
│ React + TypeScript + Vite SPA│                    │ Static Assets                │
│ shadcn/ui · Tailwind         │                    └──────────────────────────────┘
│ React Router · RHF + Zod     │
│ Recharts                     │          HTTPS + publishable key + user JWT
└──────────────────────────────┘ ─────────────────────────────────────────────►
                                      ┌────────────────────────────────────────┐
                                      │ Supabase (Singapore, provisional)     │
                                      │ Auth · PostgREST (RLS enforced)        │
                                      │ RPC · Edge Functions · Storage         │
                                      │ PostgreSQL — financial source of truth │
                                      └────────────────────────────────────────┘
```

- **Approved:** Supabase/PostgreSQL with RLS; React + TypeScript + Vite; Cloudflare Workers + Static Assets for frontend hosting (ADR-014); GitHub.
- **Approved (provisional):** Supabase region Singapore. Re-evaluate before production. Changing region later requires data migration.
- **Proposed:** a single-page app with no separate custom backend server. Server-side logic lives in Postgres functions and Edge Functions.

## 2. Responsibilities

### Frontend (presentation and input)

- Rendering, routing, forms, client-side validation (Zod) **for UX only**.
- Formatting through centralised helpers (`formatCurrency`, `formatCompactCurrency`, `formatPercentage`, `formatDate`, `formatTime`).
- Holds **no authority** over financial truth or permissions. Every rule is re-validated server-side.
- Uses only the Supabase **publishable/anon** key plus the user's session JWT.
- Never computes authoritative balances with floating-point arithmetic. It displays values returned by the database.

### Database (truth and enforcement)

- Owns the ledger, balances, invariants, and authorisation.
- **RLS on every user- or workspace-owned table** (Approved).
- **All balance-affecting mutations go through RPC functions** (Proposed: direct `INSERT/UPDATE` on ledger tables is denied to clients). Functions validate membership, role, workspace consistency, and balance, then write atomically.
- Constraints (FK, CHECK, UNIQUE, deferred balance checks) back up function logic.

### Edge Functions

- File-import parsing into staging rows (Proposed).
- Scheduled jobs: recurring execution, reminders, FX-rate fetching (Proposed).
- Run with the service role **server-side only**, and must call the same posting functions rather than writing ledger rows directly.

### Storage

- Uploaded import files and transaction attachments in private buckets, with access policies scoped by workspace (Proposed).

## 3. Workspace Architecture (Approved)

- One unified `workspaces` concept with `workspace_type ∈ {personal, household}`.
- A user has **exactly one personal workspace** and **zero or more household workspaces**.
- A household is **not a separate engine**. Both types use the same ledger, accounts, categories, and pockets. They differ only in membership, roles, and visibility rules.
- Every financial row carries a `workspace_id`. Cross-workspace references are rejected.
- Each workspace has a **base (reporting) currency**.

Membership (`workspace_members`): `workspace_id`, `user_id`, `role`, `status`, `joined_at`.

| Concept | Meaning | Grants visibility? |
|---|---|---|
| **Ownership** | Who created or owns a record (`owner_user_id`) or a workspace | Only to the owner, for private records |
| **Membership** | Being an active member of a workspace | Only to records **in that workspace** with a scope that permits it |
| **Visibility** | The scope on a record: `private`, `shared`, `shared_summary` | Yes. This is what RLS evaluates |
| **Contribution** | Money a member commits or pays toward a household | No. Contributing never exposes the source personal record |

Roles (**Proposed**): `owner`, `admin`, `editor`, `viewer`. Roles govern **actions** (invite, edit shared budget, record shared expense). They **never** override private-record boundaries. Personal workspaces have only an owner.

Membership statuses: `invited`, `active`, `left`, `removed`. Only `active` grants access. On exit (`left`/`removed`), access is revoked immediately and all household financial history and obligations are preserved (**Approved: [ADR-009](decisions/ADR-009-household-membership-exit.md)**). The exact status enum names are Proposed.

## 4. Financial Engine (Approved: double-entry)

### 4.1 Concepts

- **Financial account:** a user-facing place money lives (bank, e-wallet, cash) or is owed (credit card). Each maps to one **ledger account**: asset for bank/e-wallet/cash, **liability for credit cards** (Approved: [ADR-007](decisions/ADR-007-credit-card-liability.md)). Accounts with posted history are **archived, never hard-deleted** (Approved: [ADR-008](decisions/ADR-008-account-archiving.md)).
- **Ledger account (chart of accounts):** types `asset`, `liability`, `equity`, `income`, `expense`. Categories map to income/expense ledger accounts.
- **Transaction:** the user-facing business event (e.g. "Paid electricity bill").
- **Journal entry:** the accounting record of a transaction. It contains ≥ 2 **journal lines** whose debits equal credits.
- **Pocket:** a virtual allocation layer **outside** the asset totals (see §4.4).

### 4.2 Posting patterns (Approved conceptually)

| Event | Debit | Credit |
|---|---|---|
| Income received | Asset (account) | Income (category) |
| Expense paid | Expense (category) | Asset (account) |
| Transfer between own accounts | Destination asset | Source asset |
| Loan disbursement | Cash/bank asset | Loan liability |
| Principal repayment | Loan liability | Cash/bank asset |
| Interest payment | Interest expense | Cash/bank asset |
| Refund of an expense | Asset | Original expense (offset) |
| Credit card purchase (ADR-007) | Expense | Credit card liability |
| Credit card bill payment (ADR-007), **not an expense** | Credit card liability | Bank asset |
| Currency conversion with realized gain (ADR-006) | Destination asset (settlement value) | Source asset (carrying value) + Realized FX gain |
| Currency conversion with realized loss (ADR-006) | Destination asset + Realized FX loss | Source asset (carrying value) |

Household contributions and advances (Approved: [ADR-005](decisions/ADR-005-household-contribution-accounting.md)). Each real-world event may produce one entry **per workspace**, each balanced on its own:

| Event | Personal workspace | Household workspace |
|---|---|---|
| Contribution, actual transfer | Dr Household Contribution (expense) · Cr Personal bank | Dr Household bank · Cr Member contribution (funding) |
| Contribution, direct payment of household expense | Dr Household Contribution (expense) · Cr Personal bank | Dr Household expense · Cr Member contribution (funding) |
| Commitment | none | **none** (tracked outside the ledger) |
| Reimbursable advance | Dr Receivable from Household · Cr Personal bank | Dr Household expense · Cr Payable to member |
| Reimbursement (full or partial) | Dr Personal bank · Cr Receivable from Household | Dr Payable to member · Cr Household bank |

Single-workspace patterns continue:

| Event | Debit | Credit |
|---|---|---|
| Opening balance (Proposed) | Asset | Equity: opening balance |
| Balance adjustment (Proposed) | Asset or Equity/adjustment | the other |

The exact chart of accounts and journal-generation rules must be **documented and tested before implementation** (design review before Phase 2).

### 4.3 Engine rules (Approved)

1. Every posted journal entry balances in **base currency** (Σ debit = Σ credit), and per currency where applicable.
2. Posted entries are **immutable**. Corrections use a reversal entry plus a new entry, linked through `transaction_reversals`.
3. All posting is **atomic** (one DB transaction) and **idempotent** (client-supplied idempotency key, unique per workspace).
4. Concurrent balance-affecting operations are **serialised** (row locks on affected accounts, or advisory locks per workspace; final choice in Phase 2).
5. Every mutation writes an **audit log** entry.
6. Derived balances (`account_balances`, `pocket_balances`, report views) must **reconcile to journal lines**, with a reconciliation test suite.
7. Transfers and pocket allocations are **never** income or expense.
8. Loan proceeds are not income. Principal repayment is not an expense. Interest is an expense.

### 4.4 Pockets (Approved: [ADR-002](decisions/ADR-002-workspace-level-pockets.md))

Pockets express *intent* ("this money is for rent"). They:
- are **workspace-level** virtual allocations, owned by a workspace, not by an account;
- do **not** create ledger balances, are **not assets**, and are excluded from net worth and asset totals;
- move by **allocation records**, never journal entries. Allocations and pocket-to-pocket transfers are never income or expense;
- may link to goals.

```
Eligible workspace funds = Σ balances of eligible financial accounts   (from the ledger)
Allocated                = Σ pocket balances                            (from pocket_allocations)
Unallocated              = Eligible workspace funds − Allocated         (calculated; not an asset, not an account)
```

- A mandatory **Unallocated** balance (UI: *Belum dialokasikan*) is always shown.
- **Total allocations must not exceed eligible funds.** New allocations that would exceed them are rejected. If real spending later pushes funds below allocations, the shortfall is shown explicitly.
- Account balances remain the only source of actual money.
- *Implementation details requiring design review:* the definition of eligible accounts (including credit-card treatment), multi-currency comparison, and deficit presentation.

### 4.5 Multi-currency (Approved: BL-06, [ADR-006](decisions/ADR-006-fx-recognition.md))

- Each transaction stores the **original amount and currency**, the **FX rate snapshot** (rate, source, timestamp), the converted **base amount**, and any relevant conversion or settlement details.
- Historical entries are **never** recalculated at today's rate.
- Journal lines store both original and base amounts. The balance check uses base amounts.
- **Realized FX gain/loss** is posted when an actual conversion or settlement yields a difference between **carrying value** and **settlement value**.
- **Unrealized revaluation is not part of the V1 ledger.** It is a possible future capability. Reports may show a clearly labelled indicative current-rate value without posting it.
- Rounding differences on conversion post to a dedicated FX-rounding ledger account, separate from gain/loss (Proposed).
- *Implementation details requiring design review:* carrying-value method for partial conversions, rate provider, and refresh cadence.

### 4.6 Money representation (Approved: [ADR-001](decisions/ADR-001-monetary-storage.md))

- **Monetary amounts and balances:** `BIGINT` integer **minor units**, everywhere (DB, APIs, frontend, imports, reports).
- **`NUMERIC`** for exchange rates, ratios, percentages, and calculations needing decimal precision.
- Currency exponent comes from `currencies.minor_units` (IDR 0, USD 2, JPY 0). Never assume 2 decimals.
- Never use JS floating point for money. Use explicit conversion and rounding helpers, **half-even** rounding at a single conversion point, and deterministic allocation (ADR-010).
- Safe-integer boundaries are validated. Values above `Number.MAX_SAFE_INTEGER` must not pass through JS `number`. The wire format (string vs. number) is an implementation detail requiring design review.

## 5. Privacy Boundaries

Summarised here. Normative rules are in `HOUSEHOLD_PRIVACY.md`, [ADR-013](decisions/ADR-013-household-privacy-invariants.md) (invariants), and [ADR-003](decisions/ADR-003-shared-summary-policy.md) (`shared_summary` whitelist is **empty by default**).

- Personal workspace data is visible **only** to its owner. There is no household or admin bypass.
- Household data is visible to active household members according to scope and role.
- Personal → household information flows **only** through explicit **shared-item projections** with whitelisted fields, controlled and revocable by the member.
- Enforcement lives in **RLS and server functions**. The UI is never the security boundary.
- Household aggregates must not allow inference of private values.

## 6. Integration Architecture

| Integration | Approach | Status |
|---|---|---|
| Authentication | Supabase Auth (email/password; OAuth providers Pending) | Approved (Auth), providers Pending |
| File import | Upload to Storage → Edge Function parses to `import_rows` → user maps, reviews, dedupes → commit via posting RPC | Proposed |
| Recurring | Scheduled Edge Function / `pg_cron` creates executions with unique `(rule_id, occurrence_date)` → **draft transactions only**; the user confirms before posting. Missed runs back-fill drafts; skips recorded; failures isolated and retried | **Approved: draft-by-default ([ADR-004](decisions/ADR-004-recurring-confirmation.md))**; scheduler mechanism Proposed |
| FX rates | Scheduled fetch from a rate provider into `exchange_rates`; manual entry allowed | Proposed; provider choice requires design review |
| Notifications | In-app table first; email/push Pending | Proposed |
| Bank aggregation | Out of V1 scope | Pending (future) |
| Hosting | Cloudflare Workers + Static Assets (frontend); Cloudflare Vite plugin is the preferred Vite integration. Workers Builds/GitHub integration is proposed. | Platform approved: ADR-014; workflow details Proposed |

## 7. Security Architecture (Approved)

- RLS on every owned table; deny by default.
- Service-role key never shipped to the browser; secrets only in environment variables; `.env.local` git-ignored (already in `.gitignore`).
- `SECURITY DEFINER` functions (if used) set a fixed `search_path` and re-check `auth.uid()` membership explicitly.
- Validate that every referenced ID (account, category, pocket) belongs to the same workspace as the transaction.
- Audit logs for sensitive actions (posting, reversal, role change, sharing grant/revoke).
- Version-controlled SQL migrations only; no dashboard schema edits.
- Backup and recovery expectations defined before production (Pending).
- Automated tests for authorisation boundaries and privacy leakage.

## 8. Architecture Decisions

The authoritative list is [`DECISION_REGISTER.md`](DECISION_REGISTER.md):

- **ADR-001 to ADR-013**: V1 decisions approved 2026-11-13 (money storage, pockets, shared summary, recurring, contributions, FX, credit cards, archiving, membership exit, splits, localisation, prototype, privacy invariants).
- **BL-01 to BL-09**: baseline decisions from Project Context v1.0 (workspaces, double-entry, Supabase + RLS, React/Vite, etc.). The hosting portion of BL-04 is superseded by ADR-014. The `ADR-01…ADR-12` labels used in earlier drafts of this section are retired and replaced by these IDs.
- **ADR-014**: Cloudflare Workers + Static Assets supersedes the Vercel hosting selection in BL-04.
- **P-01 to P-04**: proposals awaiting approval (RPC-only mutations, role set, table consolidation, balance views).

## 9. Open Items

### 9.1 Resolved by ADRs (2026-11-13)

Money storage (ADR-001) · pocket model and Unallocated (ADR-002) · `shared_summary` content (ADR-003) · recurring default (ADR-004) · personal-side contribution accounting (ADR-005) · FX gain/loss and revaluation (ADR-006) · credit cards in V1 (ADR-007) · account deletion (ADR-008) · leaving a household (ADR-009) · split methods (ADR-010) · UI language (ADR-011) · prototype location (ADR-012).

### 9.2 Still pending product-owner decision

1. **Whole-user / workspace data deletion** (e.g. a privacy-motivated account-closure request) vs. the immutable ledger. ADR-008 covers financial accounts only.
2. **Household base currency** when members' personal base currencies differ.
3. **Auth providers:** email only, or also Google, etc.?
4. **Notification channels** beyond in-app.

### 9.3 Implementation details requiring design review (not product decisions)

Eligible-funds definition for pockets · carrying-value method for FX · FX rate provider · ledger account type for household member contributions · mechanism linking paired cross-workspace entries · scoped settlement view for departed members · archive-with-balance and unarchive rules · percentage input precision · money wire format · i18n library · prototype exclusion from the production build.

## 10. Noted Inconsistencies

- **Palette:** the prototype palette conflicts with the approved palette. Resolution: approved palette governs (BL-09). The prototype is not changed.
- **Module list:** the Phase 0A brief lists 16 modules, and the project context v1.0 lists 13 (including "Authentication" and "Settings, permissions, and audit history"). They are compatible. This documentation uses the 16-module list and treats Authentication and Audit as cross-cutting capabilities. **No conflict requiring a decision.**
- **Phase naming (resolved 2026-11-13):** the product owner confirmed that the application foundation is **Phase 0B**. "Phase 1" is retired, and Phases 2–6 are unchanged (see ROADMAP).
