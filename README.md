# POCKA

> **Money, in your control.**

POCKA is a personal finance management web app for young adults (18–30+) and the households they share. It helps people see where their money is, where it goes, what it is set aside for, and how their financial position changes over time.

POCKA puts **financial correctness, privacy, clarity, and ease of use** ahead of feature volume.

---

## Status

**Phase 0A: Documentation & Architecture Foundation (complete and merged).** ADR-001 to ADR-013 were approved on 2026-11-13 and merged into `main` through PR #1. ADR-014 (Cloudflare Workers + Static Assets hosting) was approved on 2026-11-21 and merged into `main` through [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3). PR #3 was documentation-only. The initial Phase 0B foundation has since merged into `main` via [PR #5](https://github.com/krellynn/pocka-personal-finance/pull/5), squash commit `a930ad7`; authentication and financial-data features have not started.

The initial Phase 0B application foundation is now on `main`. It is an application shell only and has no financial-data integration. The repository holds:

- `prototype/index.html`: the original static HTML/CSS/JS **design prototype**, relocated unchanged per [ADR-012](docs/decisions/ADR-012-prototype-preservation.md). It remains a UX reference, not production code.
- `index.html` and `src/`: the new Vite/React application shell, with no financial data integration yet.
- `docs/`: the official product and architecture documentation, including the [Decision Register](docs/DECISION_REGISTER.md).

See [`PROJECT_STATUS.md`](PROJECT_STATUS.md) for the verified, current state.

---

## Planned Features

| Area | Summary |
|---|---|
| Dashboard | Balances, cash flow, budget progress, recent activity |
| Transactions | Income, expenses, transfers, refunds, adjustments (manual + file import) |
| Accounts / Wallets | Bank accounts, e-wallets, cash, and basic credit cards (as liabilities); archived, never deleted, once used |
| Pockets | Workspace-level virtual allocations, plus a mandatory "Unallocated" figure (not extra assets) |
| Income management | Multiple income sources, separate from income categories |
| Categories | Income and expense categorisation |
| Budgets | Category budgets vs. actuals |
| Financial goals | Targets, optionally linked to pockets |
| Debt & installments | Principal and interest tracked separately |
| Recurring transactions | Scheduled income and expenses that generate **drafts** for confirmation; idempotent |
| Reports & analytics | Cash flow, net worth, budget vs. actual |
| Multi-currency | Per-transaction currency with FX snapshots; realized FX gain/loss |
| Household workspace | Shared expenses (equal, fixed, percentage, weighted splits), contributions, and reimbursements, with private data kept private |
| Notifications | Reminders and alerts |
| Settings & profile | Preferences, locale, permissions, audit history |
| Import & reconciliation | CSV/file import through a staged review workflow |

Full module descriptions are in [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md).

---

## Approved Technology Stack (foundation dependencies installed)

**Frontend target:** React · TypeScript · Vite · Tailwind CSS · Lucide icons · Recharts · React Router · React Hook Form · Zod · TanStack Query · i18next. The initial React/Vite dependencies are installed; remaining integrations are planned.

**Backend:** Supabase · PostgreSQL · Supabase Auth · Row Level Security · PostgreSQL functions/RPC · Edge Functions and Storage where needed

**Delivery:** Git + GitHub (`krellynn/pocka-personal-finance`) · Cloudflare Workers + Static Assets (frontend hosting; ADR-014) · Supabase, Singapore region (provisional)

---

## Repository Structure

Current on main:

```
pocka-personal-finance/
├── index.html                  # Vite application entry
├── README.md
├── PROJECT_STATUS.md
├── prototype/
│   └── index.html              # Original prototype, unchanged
├── src/                        # React application foundation
├── package.json
├── package-lock.json
├── docs/
│   ├── DECISION_REGISTER.md    # Authoritative index of approved decisions
│   ├── decisions/              # ADR-001 … ADR-014
│   ├── PRODUCT_OVERVIEW.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SPECIFICATION.md
│   ├── HOUSEHOLD_PRIVACY.md
│   ├── DEVELOPMENT_GUIDELINES.md
│   └── ROADMAP.md
├── .gitignore
└── .gitattributes
```

Planned later (not present in the Phase 0B foundation):

```
supabase/
  migrations/        # Database schema and policies (future work)
  functions/         # Edge Functions (future work)
tests/
  integration/       # Database and privacy tests (future work)
```

The prototype move is complete and merged via PR #5. Its Git blob is unchanged.

---

## Setup

> **Foundation scaffold only.** Run these commands from `main`. Supabase is not configured and no financial features are connected yet.

**View the original prototype:** open `prototype/index.html` on `main`. Data is stored only in the browser's `localStorage`.

**Application setup (foundation scaffold only; PR #5 is merged):**

1. `git clone https://github.com/krellynn/pocka-personal-finance.git`
2. Run `npm ci` for a reproducible install. Use `npm install` only when changing dependencies and regenerating the lockfile.
3. Supabase environment variables are blank and optional until a development project is separately configured.
4. Run `npm run dev`. No migrations are included in this foundation.
5. Run `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` before proposing a merge.

Never commit `.env.local`, and never put the Supabase service-role key in frontend code.

---

## Documentation

Read in this order:

1. [`PROJECT_STATUS.md`](PROJECT_STATUS.md): what exists and what doesn't
2. [`docs/DECISION_REGISTER.md`](docs/DECISION_REGISTER.md): **approved architecture decisions** (ADR-001 to ADR-014), linking to [`docs/decisions/`](docs/decisions/)
3. [`docs/PRODUCT_OVERVIEW.md`](docs/PRODUCT_OVERVIEW.md): vision, modules, UX
4. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design
5. [`docs/DATABASE_SPECIFICATION.md`](docs/DATABASE_SPECIFICATION.md): conceptual data model and ledger
6. [`docs/HOUSEHOLD_PRIVACY.md`](docs/HOUSEHOLD_PRIVACY.md): privacy and sharing rules (non-negotiable)
7. [`docs/DEVELOPMENT_GUIDELINES.md`](docs/DEVELOPMENT_GUIDELINES.md): coding, testing, and AI agent rules
8. [`docs/ROADMAP.md`](docs/ROADMAP.md): phased delivery plan


### V1 Master Development Package — PR #4

The V1 planning package covers:

1. [Master Development Package](docs/MASTER_DEVELOPMENT_PACKAGE_V1.md)
2. [Functional Specification](docs/FUNCTIONAL_SPECIFICATION_V1.md)
3. [Domain & API Contracts](docs/DOMAIN_AND_API_CONTRACTS_V1.md)
4. [UX & Design System](docs/UX_AND_DESIGN_SYSTEM_SPEC_V1.md)
5. [Quality & Test Strategy](docs/QUALITY_AND_TEST_STRATEGY_V1.md)
6. [Parallel Execution Plan](docs/PARALLEL_EXECUTION_PLAN_V1.md)
7. [AI Agent Playbook](docs/AI_AGENT_PLAYBOOK_V1.md)
8. [Product Owner Decisions](docs/PRODUCT_OWNER_DECISIONS_V1.md)
9. [Database & Finance Architecture Design Pack](docs/DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md)
10. [Architecture Review Report](docs/ARCHITECTURE_REVIEW_REPORT_V1.md)

See [PR #4](https://github.com/krellynn/pocka-personal-finance/pull/4) for review history. The planning package files are included under `docs/`.

**AI coding agents:** read `README.md`, `PROJECT_STATUS.md`, and `docs/DECISION_REGISTER.md` first, then follow `docs/DEVELOPMENT_GUIDELINES.md` §10. Never silently override an APPROVED ADR.

### Decision status labels

All documents use these labels:

- **Approved**: confirmed product/architecture decision (indexed in the Decision Register). Do not change without product-owner approval.
- **Proposed**: recommended direction, not yet confirmed.
- **Pending product-owner decision**: open question; do not implement an answer silently.
