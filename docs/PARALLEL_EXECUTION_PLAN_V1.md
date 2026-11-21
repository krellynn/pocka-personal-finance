# POCKA V1 — Parallel Execution Plan

**Status:** Proposed schedule; starts only after Master Package approval.  
**Capacity:** 15–20 focused hours/week.  
**Target:** 24–26 implementation weeks after planning lock; 26–28 weeks including the initial 2-week planning/design lock.

## 1. Parallelization rules

Parallel work is allowed when:
- Inputs and output contracts are documented.
- File ownership is clear.
- Work can be isolated in separate branches/worktrees.
- Shared schema, migrations and contracts have one integration owner.
- Tests can verify the boundary independently.

Parallel work is not allowed when:
- Two agents need to change the same migration or central contract simultaneously.
- Financial semantics are still unresolved.
- Household privacy/authorization rules are not finalized.
- One task depends on unmerged output from another task.
- A task's acceptance criteria are unknown.

## 2. Workstream ownership

| Workstream | Main responsibility | Can overlap with | Hard dependency |
|---|---|---|---|
| A. Product/Architecture | Requirements, ADR reconciliation, contracts, decision log | Design, test planning | Product-owner approval |
| B. Foundation/Platform | React/Vite, tooling, Auth, CI, Cloudflare config | Design system | Approved package and platform decisions |
| C. Design System/UI | Tokens, shell, components, screen scaffolds | Backend design, test harness | UX spec and data contract |
| D. Finance/Database | Schema, ledger, RPC, balances, RLS | UI scaffolding, unit tests | Chart of accounts, posting matrix, RLS matrix |
| E. Planning Modules | Pockets, budgets, goals, debt, recurring | Reports UI, test prep | Ledger + planning data contracts |
| F. Household | Members, sharing, contributions, settlement | Import UI and isolated prep | Workspace foundation + privacy/RLS contracts |
| G. Import/Reporting | Staging, import, reports/read models | Household UI scaffolding | Ledger contract; import decisions |
| H. QA/Release | Unit/integration/E2E, security, deployment | All streams | Testable merged increments |

A workstream is a responsibility, not a requirement to run a separate AI model. The product owner/integration lead remains accountable for merge order and acceptance.

## 3. Dependency gates

### Gate G0 — Planning lock
Required:
- Master package reviewed.
- Scope and exclusions approved.
- Blocking product-owner decisions resolved or formally deferred with no impact on the next phase.
- ERD/API/RLS design tasks assigned.
- Prototype preservation and hosting direction confirmed.
- No coding before this gate.

### Gate G1 — Foundation
Required:
- Prototype moved unchanged to `prototype/index.html` before Vite root entry is created.
- React/TypeScript/Vite scaffold and lockfile.
- Lint, format, typecheck, unit test and CI.
- i18n default id-ID, design tokens, shell and route guards.
- Supabase Auth and identity/workspace migrations with RLS tests.
- Cloudflare Vite plugin and Wrangler config verified in local/preview build; no production deploy.
- Personal workspace onboarding behaviour approved and tested.

### Gate G2 — Ledger contract
Required before financial posting:
- Final chart of accounts.
- Posting matrix with worked examples.
- Final schema/ERD and constraints.
- RLS policy matrix.
- RPC signatures, idempotency and error contracts.
- Currency/money wire format.
- Database tests for journal balance, immutability and workspace integrity.

### Gate G3 — Core personal finance
Required:
- Accounts, categories, sources and posting flows.
- Income, expense, transfer, refund, adjustment and reversal.
- Derived balances reconcile to journal lines.
- Critical personal finance E2E tests pass.

### Gate G4 — Planning and reporting
Required:
- Pocket eligible-funds policy.
- Budget actual rules.
- Goal and debt accounting rules.
- Recurring draft semantics.
- Report definitions reconcile to ledger.

### Gate G5 — Household
Required:
- Role/permission matrix.
- Paired cross-workspace entry design.
- Household base currency policy or explicit scope limitation.
- Contribution and settlement accounting contracts.
- P1–P20 test plan implemented and passing.

### Gate G6 — Import
Required:
- Supported file types/size limits/retention.
- Parser and staging contract.
- Duplicate policy.
- Partial commit and error handling.
- All import commits use normal posting RPCs.

### Gate G7 — Production release
Required:
- Security, privacy, accessibility and performance review.
- Backup/restore test.
- Monitoring and rollback.
- Cloudflare preview/production configuration and Supabase production review.
- Explicit product-owner deployment approval.

## 4. Proposed schedule

Weeks are calendar weeks at 15–20 hours/week. Some workstreams overlap; ranges are target windows, not independent durations to add together.

| Weeks | Main focus | Parallel work | Exit evidence |
|---|---|---|---|
| 1–2 | Complete planning and design lock | Functional/UX/QA reviews; decision closure; ERD and RPC design | G0 approved; no unresolved blocker for Phase 0B |
| 3–5 | Phase 0B foundation | Design system; Auth; CI; local Supabase; Cloudflare local/preview config | G1 passed |
| 6–9 | Ledger and core transactions | Transaction UI; account screens; finance unit tests; read models | G2 and first G3 increments |
| 10–12 | Complete core personal finance | Categories/sources; refunds/reversals; reports scaffolding; E2E | G3 passed; personal alpha |
| 13–16 | Planning modules | Pockets, budgets, goals, debt, recurring UI/tests in parallel by stable contracts | G4 passed |
| 17–19 | Dashboard/reporting and FX completion | Report reconciliation; FX tests; notification foundation | Report/FX acceptance passed |
| 20–22 | Household capabilities | Member UI, contribution/expense/settlement, RLS tests | G5 passed |
| 23–24 | Import and reconciliation | Parser/staging, preview UI, duplicate tests | G6 passed |
| 25–26 | Stabilization and release candidate | Full E2E, accessibility, security, backup, deployment rehearsal | G7 evidence and product-owner release decision |

This schedule deliberately keeps the highest-risk ledger and household privacy gates sequential, while allowing UI scaffolding, test preparation, documentation and isolated read-only modules to proceed in parallel.

## 5. Integration cadence

- Weekly integration checkpoint: merge only green, reviewed PRs.
- At least one end-to-end smoke run after each merged vertical slice.
- Database migrations are serialized through one owner; no concurrent edits to migration history.
- API contract changes require a compatibility note and impacted module list.
- Each agent delivers branch, PR, tests, changed files, known limitations and screenshots/logs where useful.
- Keep `main` releasable; no long-lived integration branch.
- Update `PROJECT_STATUS.md` at each accepted milestone.

## 6. Suggested vertical slices

1. Auth → personal workspace → profile/settings.
2. Account creation → opening balance → account balance.
3. Income posting → journal → transaction list → dashboard.
4. Expense posting → journal → category report.
5. Transfer → two accounts → neutral cash-flow classification.
6. Refund/reversal → original linkage → report correction.
7. Pocket allocation → Unallocated → no ledger mutation.
8. Budget → actuals → refund offset.
9. Debt → payment split → outstanding principal.
10. Recurring rule → draft → confirmation → one posting.
11. FX transaction → immutable snapshot → realized conversion.
12. Household invitation → role → shared expense → split.
13. Contribution/reimbursable advance → paired entries → settlement.
14. Import → staging → review → commit → reconciliation.
15. Production candidate → security/backup/rollback checks.

## 7. Schedule protection and reforecast

Reforecast if:
- A critical dependency decision is unresolved for more than one weekly checkpoint.
- A milestone misses acceptance criteria by more than one week.
- A P0/P1 financial/security defect is discovered.
- Scope is added or changed.
- Available weekly capacity drops below 15 hours for two consecutive weeks.

Do not recover schedule by skipping tests, weakening RLS, merging unreviewed migrations or reducing auditability. Reduce or defer scope only through explicit product-owner approval.

## 8. Capacity management

At 15–20 hours/week, do not assume seven independent agents can all be reviewed by one person. Use no more than 2–3 active implementation streams at a time, plus a QA/review queue. Keep the rest in ready backlog. Parallelism should reduce waiting, not create an unreviewable volume of code.
