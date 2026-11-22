# POCKA V1 — Master Development Package

**Status:** Proposed execution baseline — pending product-owner review  
**Prepared:** 2026-11-21  
**Strategy:** Complete planning + controlled parallel workstreams  
**Target capacity:** 15–20 focused hours/week (3–4 hours/day, 5 days/week)  
**Planning estimate:** 26–28 calendar weeks from approval of this package to V1 launch, including a 2-week documentation/design lock and approximately 24–26 weeks of implementation and release work.

> This package is a planning and specification artifact only. It does not implement the application, create Supabase or Cloudflare resources, run migrations, configure environments, or deploy anything. Coding starts only after the package and dependency gates have been reviewed and approved by the product owner.

## 1. Purpose

This package turns the approved POCKA product and architecture baseline into an executable plan for AI-assisted development. It gives all contributors one source of truth for:

- V1 scope and exclusions.
- Functional requirements and acceptance criteria.
- Module boundaries and dependency order.
- Data/API contract design work required before implementation.
- UI/design-system requirements.
- Financial correctness, security, privacy, and test gates.
- Parallel workstream ownership and integration rules.
- Weekly milestones and release criteria.
- AI-agent operating rules and product-owner decision backlog.

The existing Phase 0A documentation and ADRs remain authoritative. This package supplements them; it does not silently amend or supersede approved decisions.

## 2. Source-of-truth hierarchy

When documents conflict, use this order:

1. Explicit product-owner decisions recorded in an approved ADR.
2. `docs/DECISION_REGISTER.md` and the linked approved ADR.
3. Product and privacy requirements: `PRODUCT_OVERVIEW.md`, `HOUSEHOLD_PRIVACY.md`.
4. Target architecture and conceptual data model: `ARCHITECTURE.md`, `DATABASE_SPECIFICATION.md`.
5. Development and quality rules: `DEVELOPMENT_GUIDELINES.md`.
6. This Master Development Package and its supporting specifications.
7. Implementation details and code.

Report inconsistencies; do not resolve them silently. ADR-014 governs hosting: Cloudflare Workers + Static Assets. The older Vercel selection is superseded for hosting only.

## 3. Product outcome and V1 boundaries

POCKA is a personal finance management application for individuals and households. V1 must help users understand where money exists, where it goes, what it is allocated for, and how their financial position changes.

### Included in V1

1. Authentication and user profile.
2. Personal and household workspaces.
3. Financial accounts: bank, e-wallet, cash, and basic credit-card liability accounts.
4. Transactions: income, expense, transfer, refund, adjustment, reversal and repost.
5. Categories and multiple income sources.
6. Double-entry ledger, audit trail, idempotency and derived balances.
7. Workspace-level pockets and mandatory Unallocated amount.
8. Budgets and budget actuals.
9. Financial goals and milestones.
10. Debt, installments, principal/interest/fee allocation.
11. Recurring rules that create drafts for user confirmation.
12. Multi-currency with frozen FX snapshots and realized FX gain/loss only.
13. Dashboard and reports.
14. In-app notifications.
15. Household membership, roles, shared expenses, splits, contributions, settlements and reimbursements.
16. CSV/file import with staging, preview, validation, duplicate detection, review and controlled commit.
17. Reconciliation, settings, audit history, responsive UI and localization.

### Explicitly out of V1

- Bank aggregation or direct bank connections.
- Collecting bank PINs, passwords, OTPs, or full card credentials.
- Investment tracking and investment advice.
- Unrealized FX revaluation.
- Recurring auto-posting; V1 recurring items remain drafts until confirmed.
- Advanced credit-card statement cycles, rewards and billing features.
- Any shared-summary data; whitelist remains empty.
- English UI, email/push notifications, native mobile apps, and export formats beyond CSV unless separately approved.
- Custom Cloudflare Worker API/business logic without a separately approved requirement.

## 4. Approved product and technical invariants

These are not open for optimization by an AI agent:

- Double-entry accounting; every posted journal entry balances.
- Posted financial records are immutable; corrections use reversal/repost.
- Money uses PostgreSQL BIGINT minor units and TypeScript bigint; no JS floating-point money arithmetic.
- Currency precision comes from currency metadata; never assume two decimal places.
- Pocket allocations are virtual allocations, not assets, income or expenses. Unallocated is mandatory.
- Account transfers, pocket allocations, goal contributions, loan proceeds, principal repayment, credit-card bill payment and settlement must not be misclassified as income/expense.
- Refunds offset the original expense where possible.
- Recurring occurrences create drafts only; drafts do not affect balances or reports.
- FX history is frozen; V1 recognizes realized FX gain/loss only.
- Accounts with posted history are archived, not hard-deleted.
- Household salary, personal account balances, private transactions, assets and liabilities remain private.
- Household contributions and shared expenses are shared according to approved rules.
- Roles do not override privacy boundaries. Sharing is explicit, whitelisted and revocable immediately.
- `shared_summary` whitelist stays empty.
- Every user/workspace-owned table has RLS. Security is enforced in PostgreSQL/server-side functions, not only in UI.
- Supabase service-role credentials never enter browser code, repository, logs or client-visible configuration.
- UI default: Bahasa Indonesia, locale id-ID, IDR, timezone Asia/Jakarta. Light theme default; dark theme supported.
- Cloudflare Workers + Static Assets is the approved frontend hosting target; Supabase remains backend/auth/database.

See ADR-001…ADR-014 for exact decision language.

## 5. Delivery strategy

Use **complete planning followed by controlled parallel development**.

Parallelize independent deliverables (design system, UI shell, test harness, documentation, and isolated feature UI) while enforcing dependency gates for database schema, ledger rules, RLS, and cross-module contracts.

Do not run a big-bang implementation. No two agents may edit the same migration, shared contract, or central component concurrently without an explicit integration owner.

## 6. Package contents

| Document | Purpose |
|---|---|
| `FUNCTIONAL_SPECIFICATION_V1.md` | Module requirements, user journeys, acceptance criteria and failure states |
| `DOMAIN_AND_API_CONTRACTS_V1.md` | Domain boundaries, proposed entities, RPC/query contract inventory and invariants |
| `UX_AND_DESIGN_SYSTEM_SPEC_V1.md` | Navigation, screens, design tokens, component rules, responsive/accessibility requirements |
| `QUALITY_AND_TEST_STRATEGY_V1.md` | Test pyramid, finance/privacy test matrix, release quality gates |
| `PARALLEL_EXECUTION_PLAN_V1.md` | Dependency graph, workstreams, week-by-week schedule, integration cadence |
| `AI_AGENT_PLAYBOOK_V1.md` | Agent roles, scope boundaries, branch/PR protocol and handoff format |
| `PRODUCT_OWNER_DECISIONS_V1.md` | Open decisions, proposed defaults, owners and blocking milestones |

Existing product, architecture, database and privacy documents remain detailed reference specifications. This package does not replace them.

## 7. Database and finance design gate\n\nThe consolidated database/finance design review is documented in `DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md`. It is a proposed baseline, not an executable schema. D-09 to D-19 must be resolved before the corresponding financial-core work; D-20 to D-25 before household work; D-26 to D-30 before import; D-31 and operational decisions before production. G0/G2/G5/G6/G7 are explicit approval gates.\n\n## 8. Phase and milestone map

The repository's approved phase naming remains unchanged:

- Phase 0A — complete.
- Phase 0B — application foundation and authentication.
- Phase 2 — financial core and ledger.
- Phase 3 — planning modules.
- Phase 4 — dashboard and reports.
- Phase 5 — household capabilities.
- Phase 6 — import, reconciliation, QA and deployment.

The accelerated workstream plan may overlap UI, documentation, test harness, and isolated feature preparation. It must not bypass the phase exit criteria or dependency gates.

## 9. Global Definition of Done

A feature is done only when all applicable items are true:

1. Requirement and acceptance criteria are traceable to this package or an approved source document.
2. UI states include loading, empty, success, validation error, permission denied and recoverable failure where relevant.
3. Inputs are validated at client and trusted server/database boundaries.
4. Database constraints, workspace ownership and RLS are implemented and tested.
5. Financial mutations are atomic, idempotent and auditable where applicable.
6. Unit, integration, database/privacy and E2E tests appropriate to the risk pass.
7. Accessibility and responsive behaviour are checked.
8. No secret, fake financial activity, or service-role key is exposed.
9. Documentation and `PROJECT_STATUS.md` are updated.
10. PR review and CI pass; product owner approves the milestone.

## 10. Planning assumptions and estimate

- One primary product owner/operator with AI-assisted development.
- Available focused time: 15–20 hours per week.
- No full-time independent engineering team is assumed.
- AI agents can work in parallel only on isolated tasks with stable contracts and separate branches.
- External account setup, billing, verification, and product-owner decisions may introduce waiting time.
- The target is 26–28 weeks including the planning lock; the implementation target after planning approval is approximately 24–26 weeks.
- This is a planning estimate, not a delivery guarantee. High-risk financial and privacy gates are not shortened to meet a date.

## 11. Current state and explicit no-code boundary

Repository status updated 2026-11-22: Phase 0A docs and ADR-001…ADR-014 are merged. The initial Phase 0B React/Vite scaffold is on separate draft PR #5; local lockfile generation and typecheck/lint/test/build verification remain outstanding. The original prototype is moved unchanged on that feature branch. No Supabase project, financial schema, migrations, CI, Cloudflare account setup or deployment has been created.

Until this package and its dependency plan are approved, do not expand implementation beyond the separately scoped Phase 0B foundation already recorded in draft PR #5. Complete its lockfile and local verification first. Do not begin financial-core, household or import implementation before the relevant gates.

- Do not create additional application features outside the authorized foundation scope.
- Do not modify the preserved prototype.
- Do not create or run SQL migrations.
- Do not create Supabase or Cloudflare resources or configure secrets.
- Do not deploy.
- Documentation-only changes to complete/review this package are allowed.

## 12. Approval checklist

- [ ] Product owner confirms V1 scope and exclusions.
- [ ] Product owner resolves or explicitly defers blocking decisions in `PRODUCT_OWNER_DECISIONS_V1.md`.
- [ ] Product owner approves the consolidated domain/API contract plan.
- [ ] Product owner approves the database/RLS design-review outputs before migrations.
- [ ] Product owner approves the 24–26-week implementation target and parallel workstream model.
- [x] Product owner separately authorized the initial Phase 0B React/Vite foundation scaffold, tracked on draft PR #5.
- [ ] Complete G0 review and obtain any required authorization before expanding the foundation scope beyond that initial scaffold.

The initial scaffold is limited pre-work; broader foundation implementation follows the G0 gate.


## 12. Architecture review remediation and readiness boundary

The 2026-11-21 review findings R-01–R-12 and dispositions are recorded in ARCHITECTURE_REVIEW_REPORT_V1.md and the authoritative design addendum in DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md §17.

The review closes specification gaps where a safe technical contract can be documented (paired-entry recovery, idempotency, FX RLS separation, contribution posting pair, table-level RLS baseline, money wire format and reversal semantics). It does not close owner decisions for category/CoA model, FX carrying-value method/provider, pocket eligible funds, household currency/roles, or deletion/retention. The final column-level data dictionary remains a G2 deliverable.

**Readiness:** G0, G2, G5, G6 and G7 remain separate approval gates. The initial Phase 0B scaffold is separately authorized on draft PR #5; this documentation update does not authorize additional implementation, migrations, cloud resources or deployment. Further foundation work must satisfy G0; ledger work begins only after G2 approval.


## G0 decisions recorded (2026-11-22)

The delegated G0 defaults are recorded in PRODUCT_OWNER_DECISIONS_V1.md:
- npm with one committed lockfile; npm ci in CI (D-01).
- i18next + react-i18next, Indonesian default (D-02).
- TanStack Query for server state (D-03).
- Transactional/idempotent creation of one personal workspace at signup (D-04).
- Local-first Supabase; hosted Free only for isolated development/preview after limits check; production plan deferred until measured needs (D-05).
- Cloudflare Workers Free for initial preview after limits check (D-06).
- GitHub-linked PR previews with isolated preview environment; production deployment remains manually gated (D-07).

These defaults do not authorize Phase 0B implementation, cloud-resource creation, secrets configuration, migrations or deployment. G0 approval checklist items concerning product scope, consolidated domain/API contracts and database/RLS design remain separate gates.
