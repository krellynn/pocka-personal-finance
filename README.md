# POCKA

> **Money, in your control.**

POCKA is a personal finance management web app for young adults (18–30+) and the households they share. It helps people see where their money is, where it goes, what it is set aside for, and how their financial position changes over time.

POCKA puts **financial correctness, privacy, clarity, and ease of use** ahead of feature volume.

---

## Status

**Phase 0A: Documentation & Architecture Foundation (complete and merged).** ADR-001 to ADR-013 were approved on 2026-11-13 and merged into `main` through PR #1. ADR-014 (Cloudflare Workers + Static Assets hosting) was approved on 2026-11-21 and merged into `main` through [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3).

The application itself has **not been built yet**. The repository holds the static HTML/CSS/JS design prototype and the official product/architecture documentation. **Phase 0B has not started.** A proposed V1 Master Development Package is being prepared for product-owner review on branch `docs/master-development-package-v1`; it is documentation only and does not authorize coding.

See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the verified implementation state.

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

Full module descriptions are in [PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md).

---

## Technology Stack (approved, not yet installed)

**Frontend:** React · TypeScript · Vite · Tailwind CSS · shadcn/ui · Lucide icons · Recharts · React Router · React Hook Form · Zod

**Backend:** Supabase · PostgreSQL · Supabase Auth · Row Level Security · PostgreSQL functions/RPC · Edge Functions and Storage where needed

**Delivery:** Git + GitHub (`krellynn/pocka-personal-finance`) · Cloudflare Workers + Static Assets (frontend hosting; ADR-014) · Supabase, Singapore region (provisional)

---

## Repository Structure

Current:
```
pocka-personal-finance/
├── index.html                  # Static design prototype (preserved; do not modify)
├── README.md
├── PROJECT_STATUS.md
├── docs/
│   ├── DECISION_REGISTER.md
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

Planned application structure (not created):
```
index.html           # Vite app entry (replaces prototype at root)
prototype/
  index.html         # Original prototype, moved unchanged (ADR-012)
src/                 # React application
supabase/
  migrations/        # Version-controlled SQL migrations
  functions/         # Edge Functions where approved
tests/               # Unit, integration, RLS/privacy tests
```

---

## Setup

> **Not yet implemented.** No application, dependencies, or Supabase project are configured.

**View the prototype:** open `index.html` in a browser. It uses browser `localStorage` demo data and is a UX reference only.

Never commit `.env.local`, and never put the Supabase service-role key in frontend code.

---

## Documentation

### Existing approved baseline

1. [PROJECT_STATUS.md](PROJECT_STATUS.md): verified implementation status
2. [DECISION_REGISTER.md](docs/DECISION_REGISTER.md): approved architecture decisions ADR-001 to ADR-014
3. [PRODUCT_OVERVIEW.md](docs/PRODUCT_OVERVIEW.md): vision, modules and UX
4. [ARCHITECTURE.md](docs/ARCHITECTURE.md): system design
5. [DATABASE_SPECIFICATION.md](docs/DATABASE_SPECIFICATION.md): conceptual data model and ledger
6. [HOUSEHOLD_PRIVACY.md](docs/HOUSEHOLD_PRIVACY.md): privacy and sharing rules
7. [DEVELOPMENT_GUIDELINES.md](docs/DEVELOPMENT_GUIDELINES.md): coding, testing and AI agent rules
8. [ROADMAP.md](docs/ROADMAP.md): approved phased delivery sequence

### Proposed V1 Master Development Package — pending review

1. [Master Development Package](docs/MASTER_DEVELOPMENT_PACKAGE_V1.md): scope, governance and approval gates
2. [Functional Specification](docs/FUNCTIONAL_SPECIFICATION_V1.md): V1 behaviour and acceptance criteria
3. [Domain & API Contracts](docs/DOMAIN_AND_API_CONTRACTS_V1.md): module boundaries, RPC/query inventory and security contracts
4. [UX & Design System](docs/UX_AND_DESIGN_SYSTEM_SPEC_V1.md): screen inventory, tokens, components and accessibility
5. [Quality & Test Strategy](docs/QUALITY_AND_TEST_STRATEGY_V1.md): financial, privacy, integration and release tests
6. [Parallel Execution Plan](docs/PARALLEL_EXECUTION_PLAN_V1.md): dependency gates, workstreams and 26-week implementation schedule
7. [Product Owner Decisions](docs/PRODUCT_OWNER_DECISIONS_V1.md): open decisions and proposed defaults
8. [Database & Finance Architecture Design Pack](docs/DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md): conceptual ERD, CoA, posting matrix, RPC/RLS, FX, pockets, household and migration design

**AI coding agents:** read `README.md`, `PROJECT_STATUS.md`, and `docs/DECISION_REGISTER.md` first, then follow `docs/DEVELOPMENT_GUIDELINES.md` §10 and `docs/AI_AGENT_PLAYBOOK_V1.md`. Never silently override an APPROVED ADR.

### Decision status labels

- **Approved:** confirmed product/architecture decision. Do not change without product-owner approval.
- **Proposed:** recommended direction, not yet confirmed.
- **Pending product-owner decision:** open question; do not implement an answer silently.

The Master Development Package is a proposal until the product owner approves it. No coding, migrations, account setup or deployment is authorized by its creation.


### Architecture review remediation

The planning branch includes ARCHITECTURE_REVIEW_REPORT_V1.md, documenting findings R-01–R-12 and dispositions. The report and database design addendum improve specification consistency but do not approve unresolved product-owner decisions or authorize implementation. See the design pack §17 and PROJECT_STATUS.md for the readiness boundary.
