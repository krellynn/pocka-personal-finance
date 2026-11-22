# POCKA — Development Guidelines

Status labels: **Approved** · **Proposed** · **Pending product-owner decision**.

These apply from the application foundation phase onward. Where tooling is named but not yet installed, it is **Proposed**. Approved architecture decisions are listed in [`DECISION_REGISTER.md`](DECISION_REGISTER.md) and are binding.

---

## 1. Development Philosophy (Approved)

1. Financial correctness before visual polish.
2. Privacy by design. Never trade privacy for convenience.
3. Build incrementally. Implement only the current approved phase.
4. Avoid over-engineering. Support confirmed V1 needs and stay extensible.
5. Don't invent product decisions. Ask one focused question when a decision affects correctness.
6. Inspect before changing.
7. Preserve working code. Prefer minimal, reversible changes.
8. No destructive commands or migrations without explicit approval.
9. Don't claim completion without tests or direct verification.
10. Keep documentation in sync with implementation.
11. Keep demo/seed data separate from real user data.
12. Test financial rules with unit and integration tests, including edge cases and reversals.

## 2. Coding Conventions (Proposed)

- Package manager: **npm** (Approved: D-01, 2026-11-22). Commit one package-lock.json; use npm ci in CI.

- Formatter: Prettier. Linter: ESLint (typescript-eslint, react-hooks). Both run in CI.
- Files: `PascalCase.tsx` for components, `camelCase.ts` for modules, `kebab-case` for route folders.
- Code identifiers and comments in English. **All user-facing copy goes through the central i18n layer. Never hardcode user-facing strings in components.** The default UI language is **Bahasa Indonesia**, and English is a planned additional language (Approved: [ADR-011](decisions/ADR-011-ui-localization.md)).
- Small, focused modules. No dead code or commented-out blocks in `main`.
- No magic numbers for money or dates. Use named helpers and constants.

## 3. TypeScript Standards (Proposed)

- Localization library: **i18next + react-i18next** (Approved: D-02, 2026-11-22). Default locale id; all user-facing strings live in central catalogues.

- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- No `any`. Use `unknown` and narrow it. No non-null `!` without a comment explaining why.
- Database types generated from Supabase (`supabase gen types`) and never hand-edited.
- All external input (forms, URL params, RPC responses, imports) validated with **Zod** at the boundary.
- Branded types for money and IDs, e.g. `type MinorUnits = bigint & { __brand: 'MinorUnits' }`, `type WorkspaceId = string & { __brand: 'WorkspaceId' }`.
- Discriminated unions for transaction types and statuses. Use exhaustive `switch` with a `never` check.

## 4. Component Architecture (Proposed)

```
src/
  app/            # router, providers, layout shell
  features/       # one folder per module: transactions/, accounts/, pockets/, budgets/, household/ ...
    <feature>/
      components/ # feature UI
      api/        # Supabase queries and RPC calls (only place that talks to Supabase)
      schemas/    # Zod schemas
      hooks/
  components/ui/  # shadcn/ui primitives (generated; minimal edits)
  i18n/           # message catalogues: id (default), en (planned); ADR-011
  lib/
    money/        # minor-unit arithmetic, parsing, conversion, allocation; ADR-001, ADR-010
    datetime/     # local-date helpers, timezone handling
    format/       # formatCurrency, formatCompactCurrency, formatPercentage, formatDate, formatTime
    supabase/     # client creation (publishable key only)
  styles/         # Tailwind config, design tokens (light/dark)
```

- Components never call Supabase directly. They go through `features/*/api`.
- Server state is managed by **TanStack Query** (Approved: D-03, 2026-11-22). Keep transient UI state local; avoid a global client store for server data.
- Forms use React Hook Form with the Zod resolver.
- Design tokens follow the approved palette as CSS variables with light and dark themes. Icons come from **Lucide** only.
- Accessibility: keyboard navigable, visible focus, labelled inputs, WCAG AA contrast, and colour is never the only signal for positive/negative amounts (also use `+`/`−`).

## 5. Financial Calculation Rules (Approved)

1. **Never use JS `number` floating-point arithmetic for money.** Money is **`BIGINT` integer minor units** in the database and `bigint` in TypeScript. **Every monetary JSON value is a base-10 decimal integer string in minor units, regardless of magnitude**; validate at the boundary and parse to `bigint`. Never send monetary JSON numbers (Approved: D-12 Option A, 2026-11-21; [ADR-001](decisions/ADR-001-monetary-storage.md)). `NUMERIC`/decimal-safe representations are used for FX rates, ratios, and percentages.
2. Precision comes from `currencies.minor_units`. **Never assume 2 decimals.** IDR 0, USD 2, JPY 0. Display value = minor ÷ 10^exponent, formatted by the central helpers.
3. Parsing user input: accept locale formats (`12.850.000`, `12.850.000,50` for 2-dp currencies) and convert to minor units with strict validation. Reject ambiguous input, and reject more decimals than the currency exponent allows.
4. **Safe integers:** validate configured monetary maximums without converting money through JS `number`. Keep monetary values as decimal strings at JSON boundaries and `bigint` in TypeScript; never rely on `Number.MAX_SAFE_INTEGER` as a reason to switch wire formats.
5. Authoritative arithmetic (balances, conversions, budget actuals, splits) happens **in the database**. The frontend may preview totals using `bigint`.
6. Splits and allocations: **largest-remainder** method; ties broken by participant order. Σ parts must equal the total (Approved: [ADR-010](decisions/ADR-010-expense-split-methods.md)).
7. FX conversion: rate × amount in `NUMERIC`, rounded **once** with **half-even** rounding. Store the snapshot. Realized FX gain/loss only on actual conversion or settlement. No unrealized revaluation in V1 (Approved: [ADR-006](decisions/ADR-006-fx-recognition.md)).
8. Accounting patterns: follow `ARCHITECTURE.md` §4.2. Transfers, pocket allocations (ADR-002), goal contributions, loan proceeds, principal repayment, **credit-card bill payments** (ADR-007), reimbursements, and settlements are **never** income or expense.
9. Contribution vs. reimbursable advance (ADR-005) must stay distinct in every code path.
10. Recurring rules produce **drafts** only. Drafts never affect balances or reports (ADR-004).
11. Accounts with posted history are archived, never deleted (ADR-008).
12. Refunds link to the original expense and offset it.
13. Format only at presentation, via the central helpers. Never store formatted or compact strings.

## 6. Date & Time Handling (Approved)

- Default timezone `Asia/Jakarta`. Each workspace stores its own timezone.
- **Date-only values** (transaction date, due date, budget month) are plain `YYYY-MM-DD` strings in TS and `date` in Postgres.
- **Never derive a local date with `new Date().toISOString().slice(0,10)`.** That returns the UTC date and is wrong in UTC+7 before 07:00. (This bug exists in the prototype.) Use a helper such as `todayInTimeZone('Asia/Jakarta')` built on `Intl.DateTimeFormat` with an explicit `timeZone`.
- **Never parse `'YYYY-MM-DD'` with `new Date(str)`**: it is interpreted as UTC midnight. Keep it as a string or use a date library's plain-date type.
- Instants (`created_at`, `posted_at`) are `timestamptz` and displayed in the workspace timezone.
- Period boundaries (month start/end, recurring occurrences) are computed in the workspace timezone.
- Display formats: see `PRODUCT_OVERVIEW.md` §6.

## 7. Security Requirements (Approved)

- RLS enabled on every user- or workspace-owned table, in the same migration that creates it.
- Only the Supabase **publishable/anon** key in the frontend. The **service-role key never** appears in frontend code, the repo, or logs.
- Secrets live only in environment variables. `.env.local` stays git-ignored. Commit `.env.example` with placeholder names only.
- Validate in the database that every referenced ID belongs to the same workspace.
- **Approved (D-11 Option A, 2026-11-21):** every balance-affecting financial mutation must go through PostgreSQL RPC functions. Client code must not directly mutate ledger/financial fact tables. RPCs enforce actor/workspace authorization, validation, idempotency, concurrency and atomicity as applicable. Final signatures, grants and function hardening remain G2 deliverables.
- `SECURITY DEFINER` functions: fixed `search_path`, explicit `auth.uid()` checks, least privilege.
- Never collect or store bank PINs, banking passwords, OTPs, or full card/account numbers.
- Audit log every posting, reversal, role change, and sharing grant/revoke.
- Sanitise or escape any user-generated content rendered as HTML (React escapes by default; never use `dangerouslySetInnerHTML` with user data).
- Dependencies: pin versions, review new ones, and enable automated vulnerability alerts.

## 8. Testing Expectations

| Layer | Tool (Proposed) | Must cover |
|---|---|---|
| Unit | Vitest | money parsing/formatting, minor-unit math, date helpers, split rounding, Zod schemas |
| Database | pgTAP (or SQL test harness) via Supabase CLI | every invariant in `DATABASE_SPECIFICATION.md` §5; every RLS policy |
| Privacy | pgTAP / integration | all acceptance tests P1–P20 in `HOUSEHOLD_PRIVACY.md` §9 |
| Integration | Vitest + local Supabase | posting RPCs: income, expense, transfer, refund, reversal, debt payment, FX, idempotent retry, concurrent posting |
| E2E | Playwright | critical flows: sign-up, add transaction, transfer, budget, household share/revoke |

Rules:
- Financial and privacy tests are **required** for any change touching the ledger, RLS, or household features.
- Edge cases: zero/negative/huge amounts, 0-dp vs 2-dp currencies, month boundaries in Asia/Jakarta, double submit, reversal of a reversal (rejected), refund exceeding original (rejected).
- Tests never run against production. Use isolated test data.
- A feature isn't "done" until its tests pass locally and in CI, or it has been directly verified and the verification is documented.

## 9. Git Workflow (Proposed)

- `main` is always deployable. Work happens on short-lived branches: `feat/…`, `fix/…`, `docs/…`, `chore/…`.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`, `refactor:`).
- Pull requests are required for `main`. CI (lint, typecheck, unit, DB/RLS tests) must pass, and the product owner reviews.
- Never rewrite published history (`push --force` to `main` is forbidden).
- Migrations are reviewed in PRs like code. Destructive migrations need explicit approval in the PR.
- Update `PROJECT_STATUS.md` in the same PR that completes a milestone.

## 10. AI Agent Operating Rules (Approved)

### 10.1 Permanent instruction: respect approved decisions

Before implementing or changing **any** POCKA feature, an AI coding agent **must**:

1. Read `README.md`.
2. Read `PROJECT_STATUS.md`.
3. Read `docs/DECISION_REGISTER.md`.
4. Read the relevant ADRs in `docs/decisions/`.
5. Read the related architecture specifications in `docs/`.
6. Inspect the current code.
7. Confirm that the proposed implementation respects all approved decisions.

**An AI agent must not silently override an APPROVED ADR.** If an implementation appears to require changing an approved decision, the agent must:

- **Stop.**
- **Explain the conflict.**
- **Propose the smallest required change.**
- **Wait for explicit product-owner approval.**

After each approved development milestone, update `PROJECT_STATUS.md`.

### 10.2 General rules

AI coding agents working on POCKA **must**:

1. Read `README.md` and `PROJECT_STATUS.md` first.
2. Read the relevant `docs/` before implementing anything.
3. Inspect existing code, migrations, and git status before changing anything.
4. Work incrementally, in the current approved phase only.
5. Never invent product requirements. Mark gaps as **Pending product-owner decision** and ask.
6. Never silently alter approved architecture decisions. Propose changes explicitly.
7. Never expose secrets (service-role key, tokens, `.env*` contents) in code, logs, commits, or chat.
8. Never use floating-point arithmetic for money.
9. Never weaken RLS or privacy boundaries to make a feature work.
10. Never execute destructive migrations or commands without explicit approval.
11. Update `PROJECT_STATUS.md` after completing a milestone.
12. Run relevant tests before declaring work complete, and report failures honestly.

Additionally:
- Don't modify the prototype without explicit approval. When the Vite foundation is introduced, move it from root `index.html` to `prototype/index.html` with `git mv`, content unchanged (ADR-012). Never delete it.
- Don't commit or push unless the product owner asks.
- Don't insert demo or fake financial data into any real user's workspace.
- When two requirements conflict, document the conflict and ask. Don't resolve it silently.


## 11. Cloudflare Deployment (Platform Approved; Preview Workflow Approved)

- Initial preview plan: Cloudflare Workers Free, subject to a current limits check; reassess before production based on measured usage (D-06, 2026-11-22).
- Preview workflow: GitHub-linked PR/branch previews with isolated preview credentials/data. Production deploys from main remain manually gated (D-07, 2026-11-22).

- Frontend hosting uses **Cloudflare Workers + Static Assets** (Approved: [ADR-014](decisions/ADR-014-cloudflare-workers-hosting.md)); Vercel is not the approved hosting platform.
- For the Vite application, use the stable Cloudflare Vite plugin as the preferred integration direction; re-check supported versions before implementation. The plugin automatically includes the built client assets, so do not add a duplicate `assets.directory` setting without a specific need.
- Configure SPA navigation fallback for the React Router application using the supported Static Assets `not_found_handling: "single-page-application"` setting where applicable. Verify direct navigation and refresh on nested routes in preview before production.
- Keep Wrangler configuration (for example, `wrangler.jsonc`) version-controlled. Do not rely on undocumented dashboard-only configuration for reproducible application settings.
- Workers Builds/GitHub integration and branch preview deployments are **Proposed** until configured and tested. Production deployment from `main` requires the product owner's explicit approval.
- Treat all browser-delivered assets and Vite-exposed environment variables as public. Only the Supabase project URL and publishable/anon key may be included in frontend configuration. Never expose Supabase service-role keys or other secrets.
- Any future Worker secrets must be stored as server-side Cloudflare secrets/bindings and must never be returned to client assets.
- Keep `.wrangler/`, `.dev.vars`, and real local Worker variable files out of Git. A deliberately named example such as `.dev.vars.example` may be committed only when it contains placeholders and no real credentials.
- Do not add Worker API routes or move business logic from Supabase to Workers without a separately approved requirement.
- Before enabling deployment, verify SPA fallback/routing (including direct loads and refreshes on nested React Router paths), build output, preview/production separation, domain/DNS, observability, rollback, and account/plan requirements.


---

## 6. Financial Mutation Boundary (Approved — D-11, 2026-11-21)

- Every balance-affecting financial write must go through a PostgreSQL RPC.
- Browser/client code must never directly insert, update or delete ledger/financial facts.
- RPCs validate authenticated actor (`auth.uid()`), active workspace membership, operation permission, same-workspace references, input constraints, idempotency and concurrency as applicable.
- A financial command commits its related transaction, journal entries/lines, reversal state and audit facts atomically within its defined boundary.
- Table grants and RPC EXECUTE grants are deny-by-default and narrowly scoped. Do not assume `SECURITY DEFINER`; choose and harden function security mode during G2 design review.
- Reads use RLS-protected queries and approved views/read models; D-11 does not require all reads to use RPC.
- This is a binding architecture boundary, not permission to create migrations or start implementation before the relevant gate is approved.
