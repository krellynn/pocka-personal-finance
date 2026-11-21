# POCKA

> **Money, in your control.**

POCKA is a personal finance management web app for young adults (18–30+) and the households they share. It helps people see where their money is, where it goes, what it is set aside for, and how their financial position changes over time.

POCKA puts **financial correctness, privacy, clarity, and ease of use** ahead of feature volume.

---

## Status

**Phase 0A: Documentation & Architecture Foundation (complete and merged).** ADR-001 to ADR-013 were approved on 2026-11-13 and merged into `main` through PR #1. ADR-014 (Cloudflare Workers + Static Assets hosting) was approved on 2026-11-21 and is documented in [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3). The PR is documentation-only; Phase 0B (Application Foundation & Authentication) has not started.

The application itself has **not been built yet**. The repository holds:

- `index.html`: a static HTML/CSS/JS **design prototype** that runs on local demo data. It is a UX reference, not the production architecture. It will move to `prototype/index.html` when the Vite app is introduced ([ADR-012](docs/decisions/ADR-012-prototype-preservation.md)).
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

Planned (created in the application foundation phase):

```
index.html           # Vite app entry (replaces the prototype at root)
prototype/
  index.html         # Original prototype, moved unchanged (Approved: ADR-012)
src/                 # React application (Proposed layout)
supabase/
  migrations/        # Version-controlled SQL migrations
  functions/         # Edge Functions (import, scheduled jobs)
tests/               # Unit, integration, RLS/privacy tests
```

The prototype move is a **future action**. It has not been performed yet.

---

## Setup

> ⚠️ **Not yet implemented.** No application, dependencies, or Supabase project are configured. The steps below are the *intended* setup and will be confirmed in Phase 0B (Application Foundation).

**View the prototype (works today):** open `index.html` in a browser (later: `prototype/index.html`). Data is stored only in the browser's `localStorage`.

**Application setup (planned, not yet implemented):**

1. `git clone https://github.com/krellynn/pocka-personal-finance.git`
2. Install dependencies (package manager: implementation detail requiring design review). *Not yet available.*
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and the **publishable/anon** key only. *Not yet available.*
4. Apply migrations to a **local/dev** Supabase instance. *Not yet available.*
5. Start the dev server. *Not yet available.*

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

**AI coding agents:** read `README.md`, `PROJECT_STATUS.md`, and `docs/DECISION_REGISTER.md` first, then follow `docs/DEVELOPMENT_GUIDELINES.md` §10. Never silently override an APPROVED ADR.

### Decision status labels

All documents use these labels:

- **Approved**: confirmed product/architecture decision (indexed in the Decision Register). Do not change without product-owner approval.
- **Proposed**: recommended direction, not yet confirmed.
- **Pending product-owner decision**: open question; do not implement an answer silently.
