# POCKA

> **Money, in your control.**

POCKA is a personal finance management web app for young adults (18–30+) and the households they share. It helps people see where their money is, where it goes, what it is set aside for, and how their financial position changes over time.

POCKA puts **financial correctness, privacy, clarity, and ease of use** ahead of feature volume.

---

## Status

**Phase 0A: Documentation & Architecture Foundation (complete and merged).** ADR-001 to ADR-013 were approved on 2026-11-13 and merged into `main` through PR #1. ADR-014 (Cloudflare Workers + Static Assets hosting) was approved on 2026-11-21 and merged into `main` through [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3). The PR was documentation-only; Phase 0B (Application Foundation & Authentication) has not started.

The Phase 0B application foundation is scaffolded on the feature branch `feat/phase-0b-application-foundation` and is under review. The repository holds:

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

## Technology Stack (approved, not yet installed)

**Frontend:** React · TypeScript · Vite · Tailwind CSS · Lucide icons · Recharts · React Router · React Hook Form · Zod · TanStack Query · i18next

**Backend:** Supabase · PostgreSQL · Supabase Auth · Row Level Security · PostgreSQL functions/RPC · Edge Functions and Storage where needed

**Delivery:** Git + GitHub (`krellynn/pocka-personal-finance`) · Cloudflare Workers + Static Assets (frontend hosting; ADR-014) · Supabase, Singapore region (provisional)

---

## Repository Structure

Current:

```
pocka-personal-finance/
├── index.html                  # Vite application entry
├── README.md
├── PROJECT_STATUS.md
├── prototype/
│   └── index.html              # Original prototype, unchanged
├── src/                        # React application foundation
├── package.json
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

The prototype move is complete on the Phase 0B feature branch. Its Git blob is unchanged.

---

## Setup

> **Foundation scaffold only.** Run the commands below from the feature branch. Supabase is not configured and no financial features are connected yet.

**View the prototype (works today):** open `index.html` in a browser (later: `prototype/index.html`). Data is stored only in the browser's `localStorage`.

**Application setup (planned, not yet implemented):**

1. `git clone https://github.com/krellynn/pocka-personal-finance.git`
2. Run `npm install` (then use `npm ci` for reproducible clean installs).
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

**AI coding agents:** read `README.md`, `PROJECT_STATUS.md`, and `docs/DECISION_REGISTER.md` first, then follow `docs/DEVELOPMENT_GUIDELINES.md` §10. Never silently override an APPROVED ADR.

### Decision status labels

All documents use these labels:

- **Approved**: confirmed product/architecture decision (indexed in the Decision Register). Do not change without product-owner approval.
- **Proposed**: recommended direction, not yet confirmed.
- **Pending product-owner decision**: open question; do not implement an answer silently.
