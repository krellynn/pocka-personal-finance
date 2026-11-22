# POCKA — Roadmap

Status labels: **Approved** · **Proposed** · **Pending product-owner decision**.

The phase sequence is **Approved** (from the Phase 0A brief). Approved architecture decisions are in [`DECISION_REGISTER.md`](DECISION_REGISTER.md). Scope details within each phase are **Proposed** and confirmed by the product owner at the start of each phase. Each phase ends with a review gate: tests passing, `PROJECT_STATUS.md` updated, and product-owner approval.

---

## Phase 0 — Foundation & Documentation

**0A: Documentation & Architecture Foundation** *(complete; merged into `main` via PR #1)*
- README, PROJECT_STATUS, `docs/` (product, architecture, database, privacy, guidelines, roadmap).
- Prototype documented and preserved.

**V1 architecture decisions** *(ADR-001 to ADR-014 approved and merged into `main`; ADR-014 merged 2026-11-21 via PR #3)*
- ADR-001 to ADR-014 are recorded in `DECISION_REGISTER.md` and `docs/decisions/`. ADR-014 selects Cloudflare Workers + Static Assets and supersedes only the Vercel hosting portion of BL-04.

**Design review items** *(scheduled before the phase that needs them; see ARCHITECTURE §9.3)*
- Final consolidated schema (DATABASE_SPECIFICATION §4), chart of accounts, and journal-posting rules with worked examples, before Phase 2.
- RLS policy matrix (table × role × scope), before the first migrations.
- Design tokens (light/dark) from the approved palette, in the foundation phase.

> **Naming (confirmed by product owner, 2026-11-13):** the application foundation is **Phase 0B**. The former "0B: Design Finalisation" scope is covered by the ADRs and the design-review items above. The number "Phase 1" is retired so Phases 2–6 keep their numbers.

## Phase 0B — Application Foundation & Authentication

- **Move the prototype** from root `index.html` to `prototype/index.html` with `git mv`, content unchanged, before creating the Vite entry `index.html` (ADR-012).
- Scaffold React + TypeScript + Vite. Add Tailwind, shadcn/ui, Lucide, React Router, RHF, Zod.
- i18n foundation with **Bahasa Indonesia** default catalogue; English planned (ADR-011).
- Lint, format, typecheck, Vitest, and CI on GitHub.
- Design tokens, theme (light default, dark supported), app shell, responsive navigation.
- Central `lib/money` (BIGINT minor units, half-even conversion, largest-remainder allocation; ADR-001, ADR-010), `lib/datetime`, `lib/format` helpers with unit tests.
- Supabase project (Singapore, provisional), local dev setup, `.env.example`.
- Migrations: `profiles`, `workspaces`, `workspace_members`, `user_settings`, `currencies` with RLS.
- Supabase Auth: sign-up, sign-in, sign-out, password reset. Personal workspace auto-created on sign-up (Proposed).
- Cloudflare Workers + Static Assets hosting (platform approved by ADR-014). Workers Builds/GitHub integration for preview deployments is Proposed; configure and verify during Phase 0B. Do not deploy until the product owner approves the deployment setup.
- Exit: a user can sign up and land in an empty personal workspace. RLS tests for identity tables pass.

## Phase 2 — Financial Core & Ledger

- Ledger accounts, financial accounts (bank, e-wallet, cash, **basic credit card as liability**, ADR-007), opening balances, account archiving (ADR-008).
- Categories and income sources.
- Transactions via posting RPCs: income, expense, transfer, refund, adjustment.
- Reversal and repost. Immutability triggers. Idempotency. Concurrency control.
- Multi-currency: currencies, exchange rates, FX snapshots on posting, realized FX gain/loss on conversion (ADR-006).
- Audit logs.
- Transactions list, entry form, account views.
- Exit: all ledger invariants are tested (balanced entries, immutability, idempotency, workspace consistency, FX history, transfer neutrality, credit-card payment neutrality, no hard delete with history). Balances reconcile to journal lines.

## Phase 3 — Planning Modules

- Workspace-level pockets, allocations, and mandatory Unallocated figure (ADR-002).
- Budgets (monthly) with computed actuals and refund offsets.
- Financial goals (optionally linked to pockets) and milestones.
- Debt and installments: schedules, payments split into principal, interest, and fee.
- Recurring rules generating **drafts for confirmation** (ADR-004), skip/pause/cancel, missed-run back-fill, duplicate-safe scheduler.
- Exit: pockets never affect net worth, and allocations never exceed eligible funds (tested). Debt split invariant tested. Recurring retries create no duplicate drafts, and drafts never affect balances (tested).

## Phase 4 — Dashboard & Reports

- Dashboard: balances, cash flow, budget progress, recent activity, goals, upcoming bills.
- Reports: cash flow, income/expense by category and source, budget vs. actual, net worth, debt status.
- Recharts visualisations; compact currency on cards and charts only.
- Notifications (in-app first).
- Exit: report figures reconcile to the ledger in automated tests.

## Phase 5 — Household Capabilities

- Household workspace creation, invitations, roles, membership lifecycle including exit that revokes access and preserves records and obligations (ADR-009).
- Shared accounts, budgets, pockets, goals in the household workspace.
- Shared expenses with **equal, fixed, percentage, and weighted** splits (ADR-010).
- Contributions: commitments, actual transfers, direct payments (`contribution` / `reimbursable_advance`), paired personal-side entries, partial payments and reimbursements (ADR-005).
- Settlements and reimbursements.
- Sharing projections with whitelists and instant revocation. `shared_summary` stays empty (ADR-003, ADR-013).
- Household reports (privacy-filtered).
- Exit: **all privacy acceptance tests P1–P20 pass**. Settlement creates no income or expense (tested).

## Phase 6 — Import, Reconciliation, QA & Deployment

- File/CSV import: upload, staging, mapping, validation, duplicate detection, review, partial commit, job history.
- Reconciliation matching.
- Full QA pass: E2E, accessibility, performance, security review (RLS audit, secrets scan).
- Backup and recovery plan, monitoring, error tracking.
- Production Supabase and Cloudflare Workers configuration, region re-evaluation.
- Exit: production launch approved by the product owner.

---

## Later / Out of V1 (Pending)

Bank aggregation, investment tracking, unrealized FX revaluation (ADR-006), optional recurring auto-posting (ADR-004), advanced credit-card features such as statement cycles and rewards (ADR-007), any `shared_summary` field (ADR-003), English and other UI languages (ADR-011), email/push notifications, native mobile apps, additional budget periods, data export formats beyond CSV.


---

## Accelerated V1 Execution Overlay (Proposed; pending package approval)

The approved phase sequence and each phase's exit criteria above remain authoritative. To shorten calendar time without bypassing financial/security gates, use controlled parallel workstreams as specified in [PARALLEL_EXECUTION_PLAN_V1.md](PARALLEL_EXECUTION_PLAN_V1.md).

**Planning target:** 26–28 calendar weeks from approval of the complete planning package, including approximately 2 weeks for planning/design lock and 24–26 weeks for implementation and release work, assuming 15–20 focused hours per week. This is an estimate, not a commitment.

| Window | Main focus | Parallel preparation |
|---|---|---|
| Weeks 1–2 | Complete planning and design lock | Functional/UX/QA reviews, decision closure, ERD/RPC/RLS design |
| Weeks 3–5 | Phase 0B foundation | Design system, Auth, CI, local Supabase, Cloudflare local/preview configuration |
| Weeks 6–9 | Phase 2 ledger and core transactions | Transaction UI, account screens, finance unit tests and read models |
| Weeks 10–12 | Complete core personal finance | Categories/sources, refunds/reversals, reports scaffolding, E2E |
| Weeks 13–16 | Phase 3 planning modules | Pockets, budgets, goals, debt and recurring |
| Weeks 17–19 | Phase 4 dashboard/reports and FX completion | Report reconciliation, FX tests, in-app notification foundation |
| Weeks 20–22 | Phase 5 household | Member UI, contribution/expense/settlement and RLS tests |
| Weeks 23–24 | Phase 6 import/reconciliation | Parser, staging, preview, duplicate and partial-commit tests |
| Weeks 25–26 | Stabilization/release candidate | Full E2E, accessibility, security, backup and deployment rehearsal |

This overlay does not authorize work beyond the separately authorized initial Phase 0B React/Vite scaffold merged via PR #5. Further foundation work follows Master Development Package review, Gate G0 and explicit scope authorization. Parallel work is limited to independent tasks with stable contracts; migrations, ledger semantics and privacy boundaries remain gated and reviewed.
