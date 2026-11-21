# POCKA V1 — Product Owner Decision Backlog

**Status:** Open decision register. Items marked Proposed are recommendations, not approved decisions.  
**Rule:** AI agents must not choose silently. A decision can be deferred only if it does not affect the next implementation gate or financial/privacy correctness.

## 1. Blocking decisions before Phase 0B / G0

| ID | Decision | Current status | Recommended direction | Why it matters |
|---|---|---|---|---|
| D-01 | Package manager | Pending design review | npm initially (already present in earlier local audit); use one committed lockfile | Reproducible installs and CI |
| D-02 | i18n library | Pending design review | Select a maintained React i18n library after a short compatibility review | Centralized Indonesian copy and future locale support |
| D-03 | Server-state/query library | Pending design review | TanStack Query is proposed, not mandatory | Cache invalidation and server-state consistency |
| D-04 | Personal workspace creation | Proposed | Auto-create one personal workspace after successful sign-up, transactionally/idempotently | Defines onboarding and identity invariants |
| D-05 | Supabase plan and project setup | Pending owner review | Start with local development; select hosted plan only after usage/billing review | Avoid unexpected cost and plan limits |
| D-06 | Cloudflare account/plan | Pending owner review | Start with Workers Free for static-first development/preview, recheck current limits; production choice subject to usage | Hosting cost and deployment limits |
| D-07 | Cloudflare preview workflow | Proposed | GitHub-linked preview deployments with explicit preview/production separation | Safe release workflow |
| D-08 | Supabase region | Approved provisional | Singapore; re-evaluate before production as required by BL-08 | Data location and migration implications |

## 2. Blocking before financial core / G2

| ID | Decision | Current status | Recommended direction | Why it matters |
|---|---|---|---|---|
| D-09 | Final chart of accounts | Pending design review | Define account classes and system mappings with worked examples before posting RPCs | Every posting depends on it |
| D-10 | Journal posting matrix | Pending design review | Document debit/credit lines for every V1 transaction type, including reversals | Financial correctness |
| D-11 | RPC-only financial mutation | Proposed (P-01) | Approve all balance-affecting writes through PostgreSQL RPC; no direct client writes to ledger tables | Atomicity and authorization |
| D-12 | Money wire format | Pending design review | Integer minor-unit decimal strings in JSON; parse to bigint in TypeScript | Avoid precision loss |
| D-13 | Balance/read model | Proposed (P-04) | Start with SQL views; materialize only after measured need | Reconciliation and simplicity |
| D-14 | Account archive/unarchive with nonzero balance | Pending design review | Archive only when no new posting; retain balance/history; define controlled unarchive | Preserve ledger |
| D-15 | Refund limits and partial refunds | Pending design review | Support partial refunds with cumulative total capped at original refundable amount | Avoid over-refund |
| D-16 | Pocket eligible-funds policy | Pending design review | Define eligible funds per account and currency, including negative balances and credit-card liabilities | Prevent over-allocation |
| D-17 | Debt edge cases | Pending design review | Define overpayment, early settlement, schedule edits and fee treatment | Liability accuracy |
| D-18 | FX carrying-value method | Pending design review | Choose a documented basis consistent with ADR-006; no unrealized revaluation | Correct realized gain/loss |
| D-19 | FX rate provider | Pending design review | Select provider only after availability, terms, reliability and cost review; allow manual rate fallback if approved | Multi-currency operation |

## 3. Blocking before household / G5

| ID | Decision | Current status | Recommended direction | Why it matters |
|---|---|---|---|---|
| D-20 | Household base currency when member currencies differ | Pending product-owner decision | Select one household reporting currency at workspace creation; require explicit FX snapshots for cross-currency contributions (proposal) | Household reporting |
| D-21 | Household role permission matrix | Proposed | owner/admin/editor/viewer with explicit operation matrix; roles never override private data | RLS and invitations |
| D-22 | Paired cross-workspace entry model | Pending design review | Use linked, independently authorized personal/household entries with private correlation ID | Contribution and reimbursement accounting |
| D-23 | Settlement access after member exit | Pending design review | Provide a narrow, obligation-only view without restoring general household membership | ADR-009 implementation |
| D-24 | Household shared account ownership | Pending design review | Define allowed account types and visibility by workspace; never infer member personal balances | Ledger and privacy |
| D-25 | Household invitation identity | Pending design review | Invite by email, store token hash, require authenticated matching user | Secure membership |

## 4. Blocking before import / G6

| ID | Decision | Current status | Recommended direction | Why it matters |
|---|---|---|---|---|
| D-26 | Import file types | Pending design review | CSV first for V1; add spreadsheet formats only after parser review | Scope and test matrix |
| D-27 | File size/row limits | Pending design review | Set conservative configurable limits and validate server-side | Resource and abuse control |
| D-28 | Duplicate detection policy | Pending design review | Exact-match rules plus explainable probable duplicates; never auto-discard uncertain rows | Data integrity |
| D-29 | Import retention and storage | Pending design review | Private bucket, short-lived raw files, retained job/row audit metadata according to privacy policy | Privacy and cost |
| D-30 | Partial commit semantics | Pending design review | Commit valid reviewed rows independently; report failed/skipped rows and retry safely | Reliable import |

## 5. Blocking before production / G7

| ID | Decision | Current status | Recommended direction | Why it matters |
|---|---|---|---|---|
| D-31 | Whole-user/workspace deletion | Pending product-owner decision | Define account closure, export/retention and ledger audit handling before production | Privacy/legal expectations |
| D-32 | Auth providers beyond email | Pending product-owner decision | Keep email for initial V1; add OAuth only with explicit approval | Scope/security |
| D-33 | Notification channels beyond in-app | Pending product-owner decision | Keep in-app only for V1 | Scope and vendor dependency |
| D-34 | Backup/restore objectives | Pending design review | Define RPO/RTO and test restore before production | Operational resilience |
| D-35 | Production domain/DNS and plan | Pending owner review | Decide after preview validation and cost review | Launch readiness |
| D-36 | Monitoring/error tracking | Pending design review | Select provider and data-redaction policy before production | Reliability and privacy |

## 6. Decision handling rules

- Product decisions require explicit product-owner approval.
- Implementation design reviews may be resolved by the designated architect only when they do not alter approved product semantics; record the rationale.
- A pending item may be deferred only if the dependency plan identifies the exact milestone when it becomes blocking.
- No AI agent may infer approval from silence.
- When a decision changes an ADR, create a new ADR that explicitly supersedes the prior decision and update the register and affected docs.
