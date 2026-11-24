# POCKA — Project Status

**Last updated:** 2026-11-23
**Current phase:** Phase 0B — Application Foundation. The initial React/Vite scaffold merged into `main` via PR #5 (squash commit `a930ad7`, 2026-11-22). Local install, tests, typecheck, lint, and build passed. Phase 0B Auth (email/password, profiles, personal-workspace provisioning, identity RLS) is implemented and verified against the **local** Supabase stack only; uncommitted at time of writing. Phase 0A remains complete.

---

## 1. Last Verified Git State

| Item | Value |
|---|---|
| `main` (origin) | Phase 0B foundation scaffold merged via PR #5 (`a930ad7`); no financial integration |
| Completed PR | [PR #1](https://github.com/krellynn/pocka-personal-finance/pull/1), `docs/phase-0-architecture` → `main`, **merged** |
| Completed PR | [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3), `docs/cloudflare-workers-deployment` → `main`, **merged** |
| Planning PR | [PR #4](https://github.com/krellynn/pocka-personal-finance/pull/4), `docs/master-development-package-v1` → `main`, **product-owner approved 2026-11-22** |
| Completed PR | [PR #5](https://github.com/krellynn/pocka-personal-finance/pull/5), `feat/phase-0b-application-foundation` → `main`, **merged** (squash `a930ad7`) |
| Remote | `origin` → `https://github.com/krellynn/pocka-personal-finance.git` |

The Phase 0A documentation and ADR-001 to ADR-014, plus the initial Phase 0B scaffold, are merged into `main`. The V1 planning package is documented under `docs/`; the product owner approved its planning checklist on 2026-11-22. G2/G5/G6/G7 implementation gates remain in force.

---

## 2. Implementation Status Summary

| Component | Status |
|---|---|
| Product & architecture documentation | **Phase 0A complete** and merged into `main` via PR #1 |
| Architecture decisions (ADR-001 to ADR-014) | **Approved and merged** into `main` via PR #1 and PR #3 |
| Static design prototype (`prototype/index.html`) | **Moved unchanged** and merged via PR #5 (ADR-012) |
| React/Vite application | **Initial scaffold merged; local checks pass** |
| Dependencies / `package.json` | **Manifest and `package-lock.json` committed; install verified** |
| Supabase project, Auth, database | **Local only**: Supabase CLI stack (Docker); email/password Auth wired into the app. No hosted project |
| SQL migrations / RLS policies | **Identity only** (`supabase/migrations/20261123120000_identity_foundation.sql`): profiles, workspaces, workspace_members, user_settings + RLS. No financial migrations (G2) |
| Double-entry ledger | **Not started** (specified only) |
| Household workspace & privacy | **Not started** (specified only) |
| Multi-currency | **Not started** (specified only) |
| Import / reconciliation | **Not started** (specified only) |
| Tests | **21 Vitest tests** (unit, component, local-Supabase integration) + **40 pgTAP** database tests pass |
| Cloudflare Workers hosting/deployment | **Static Assets config scaffolded; no account/deployment configured** |
| CI | **Not configured** |

Beyond the initial application shell, target features remain unimplemented. All financial-engine, privacy, and database content in `docs/` is **specification**, not built behaviour.

---

## 3. Existing Prototype Capabilities (`prototype/index.html`)

The preserved single-file static HTML/CSS/vanilla-JS prototype, about 27 KB, is a design and UX reference only.

### Works (interactive)

- Sidebar navigation between six views: Dashboard, Wallets, Transactions, Budgets, Reports, Settings.
- Responsive layout: full sidebar on desktop, icon rail at ≤900px, bottom tab bar at ≤650px.
- "Add transaction" modal (expense/income, amount, category, date, note) with basic amount validation (> 0, ≤ 999 billion) and HTML escaping of user text.
- Transactions are saved to browser `localStorage` (key `pocka-demo-transactions-v1`), seeded with 8 demo transactions.
- Dashboard "Recent transactions" (top 5) and the Transactions table are rendered from stored data.
- Income and expense cards sum November 2026 transactions.
- "Reset demo data" in Settings.
- Toast notifications, Escape/backdrop closes the modal.

### Static or simulated (not functional)

- Cash-flow chart: hardcoded SVG path.
- Budget overview on Dashboard: hardcoded values.
- **Budgets page list is empty**: the container `#budgetsPage` is never populated.
- Wallets page: three hardcoded wallets; the Transactions table shows "Everyday Wallet" for every row.
- Reports page: hardcoded figures.
- Settings: display only (currency, language, storage).
- Period selector: shows a toast only and filters nothing.
- Notification button: no behaviour.
- Greeting date and user name: hardcoded.
- Percent-change deltas ("↗ 8,2%"): hardcoded.

### Not present

Authentication, accounts/ledger, transfers, edit/delete of transactions, pockets, goals, debt, recurring, multi-currency, household, import, dark mode, persistence beyond one browser.

---

## 4. Known Issues in the Prototype

These are documented only. The prototype at `prototype/index.html` remains unchanged; its issues must not be carried into the real app.

1. **Brand palette mismatch.** The prototype uses a lime/deep-green palette (`#b7ef72`, `#294b37`, `#f7f8f5`). The approved palette is `#F4F6F2` / `#FFFFFF` / `#172D45` / `#64766C` / sage `#9BCDB6` / soft blue `#9BC5F5` / soft yellow `#F6D58A`. The **approved palette governs** the real app.
2. **Currency format.** The prototype renders `Rp 12.450.000` (with a space). The approved format is `Rp12.450.000` (no space).
3. **UTC date bug.** The default transaction date uses `new Date().toISOString().slice(0,10)`, which returns the UTC date. In Asia/Jakarta (UTC+7), between 00:00 and 06:59 local time this pre-fills **yesterday's** date.
4. **Fake fallback values.** Income and expense cards fall back to hardcoded amounts (`exp || 4275000`) when the real sum is 0, so they show fictitious money instead of Rp0.
5. **Balance is not ledger-derived.** Total balance = hardcoded 12.450.000 adjusted by deltas from seed totals. It does not reconcile to any account.
6. **Accounts vs. pockets conflation.** "Savings Pocket" appears as a wallet/account. In the approved model (ADR-002), pockets are workspace-level virtual allocations, not accounts, and an Unallocated figure is required.
7. **Inconsistent categories.** Seed income uses category `Income`, while the form offers `Salary`. There is no income-source vs. category separation.
8. **Floating-point money in JS.** Amounts are JS `Number`s. That is acceptable for a demo but forbidden for the real app, which uses `BIGINT` minor units (ADR-001).
9. **Icons are Unicode glyphs/emoji**, not Lucide.
10. **No dark mode**, while the approved design supports it.
11. **Mixed UI language** (English and Indonesian labels). The approved default UI language is **Bahasa Indonesia**, with English planned later (ADR-011).

---

## 5. Missing Components (to reach V1)

Everything beyond the initial app shell remains unimplemented: Auth, workspaces, ledger, accounts, transactions, categories, income sources, pockets, budgets, goals, debt, recurring, multi-currency, household sharing and settlement, import/reconciliation, reports, notifications, audit logs, RLS policies, integration tests, CI, and deployment. See `docs/ROADMAP.md`.

---

## 6. Next Milestones

1. **Phase 0B foundation done locally**: auth, profile, personal workspace (PR #6) and the G0 visual/accessibility review (section 12). Cloudflare preview review waits for G7.
2. **G2 finance design**: draft for the first slice (G2a, single-currency core) is in `docs/G2A_FINANCE_CORE_DRAFT_V1.md`, approved 2026-11-25 (G2a); implementation in progress. FX (D-18/D-19), debt detail and adjustment rules still need their own approval (G2b/G2c) before any code.
3. **G5/G6/G7**: retain separate gates for household, import and production readiness.

---

## 7. Decisions and Open Questions

**Resolved by approved ADRs** (see `docs/DECISION_REGISTER.md`): ADR-001 to ADR-013 (2026-11-13) cover money storage, pocket model and Unallocated, shared summary (empty), recurring drafts, contribution accounting, FX recognition, credit cards, account archiving, household exit, split methods, UI language, prototype location, and privacy invariants. ADR-014 (2026-11-21) selects Cloudflare Workers + Static Assets and supersedes only the hosting portion of BL-04.

**Still pending product-owner decision** (ARCHITECTURE §9.2):
- Whole-user/workspace data deletion vs. the immutable ledger.
- Household base currency when members' base currencies differ.
- Auth providers beyond email.
- Notification channels beyond in-app.

**Implementation details requiring design review** (not product decisions) are listed in ARCHITECTURE §9.3.

---

## 8. Change Log

| Date | Phase | Change |
|---|---|---|
| 2026-11-13 | 0A | Created README, PROJECT_STATUS, and `docs/` (6 files). No code, dependency, database, or deployment changes. `index.html` untouched. |
| 2026-11-13 | 0 (decisions) | Recorded 13 approved ADRs: created `docs/DECISION_REGISTER.md` and `docs/decisions/ADR-001…013`. Updated all docs for consistency. Retired the old `ADR-01…12` labels in favour of `BL-01…09`. Documentation only. `index.html` untouched. |
| 2026-11-13 | 0 (commit) | Committed all Phase 0 documentation as `11690eb` on `docs/phase-0-architecture` and opened PR #1 to `main`. Application foundation named Phase 0B. |
| 2026-11-13 | 0 (review) | PR #1 review corrections: Git/PR status brought up to date in PROJECT_STATUS and README. |
| 2026-11-13 | 0A | Phase 0A documentation merged into `main` via PR #1 (merge commit `0bea092`). |
| 2026-11-21 | 0 (architecture decision) | Approved ADR-014: Cloudflare Workers + Static Assets supersedes the Vercel hosting portion of BL-04. Documentation-only update; no application or deployment changes. |
| 2026-11-21 | 0 (documentation merge) | Merged PR #3 into `main` (squash commit `c804e33`); synchronized README, PROJECT_STATUS, and ROADMAP after merge. |
| 2026-11-22 | 0B (foundation) | Merged PR #5 into `main` (squash commit `a930ad7`); generated npm lockfile and verified tests, typecheck, lint, and build. |
| 2026-11-22 | V1 planning | Product owner approved scope, documented decision dispositions, domain/API planning baseline, conceptual database/RLS baseline, schedule and G0 defaults. Deferred gates remain open. |
| 2026-11-23 | 0B (auth) | With explicit product-owner approval of the local identity migration: local Supabase CLI stack, identity migration + RLS, trusted idempotent personal-workspace provisioning (D-04), email/password Auth UI, password reset, session restore, protected routes. Verified locally only. |


## 9. Phase 0B foundation update (2026-11-22)

- Merged the initial React + TypeScript + Vite app shell, Tailwind tokens, React Router, TanStack Query provider and Indonesian i18n catalogue into `main` via PR #5.
- Added empty-state dashboard and module placeholders; no fake balances, transactions or demo financial records.
- Added bigint minor-unit currency formatter and Asia/Jakarta date helper with unit tests.
- Moved the original prototype to `prototype/index.html` unchanged (blob SHA `cedf21040191bb93c4cfa4ddcdce4d9c6c8e0f07`).
- Added Wrangler Static Assets SPA fallback configuration. No Cloudflare resources or deployment were created.
- Generated and committed `package-lock.json`; `npm test` (5 tests), `npm run typecheck`, `npm run lint`, and `npm run build` passed locally before and after merge. The V1 planning package and architecture review are documented under `docs/`.
- No Supabase resources, Auth, schema, migrations, RLS, ledger or RPCs were created. G2 remains a hard gate.

## 10. V1 planning package status

- The V1 Master Development Package, finance architecture design pack, product-owner decisions and architecture review remediation are documented under `docs/`; the planning checklist was approved on 2026-11-22. Detailed finance, household, import and production deliverables remain gated.
- The package records D-09 to D-16 approved decisions separately from remaining G2/G5/G6/G7 implementation deliverables.
- PR #5 is merged. Product-owner approval of the V1 planning baseline is recorded; pending choices and implementation gates remain as documented.

## 11. Phase 0B Auth update (2026-11-23)

- Local-only Supabase (CLI v3, Docker; D-05). `.env.local` holds the local URL and publishable key only; no hosted project, secrets or deployment.
- Migration `20261123120000_identity_foundation.sql`: `profiles`, `workspaces` (`personal_owner_id UNIQUE`), `workspace_members`, `user_settings`; RLS on all four, explicit column-scoped grants to `authenticated`, nothing for `anon`, no client insert/delete.
- D-04 provisioning: `AFTER INSERT ON auth.users` trigger calls `private.provision_user` (SECURITY DEFINER, empty search_path, ON CONFLICT DO NOTHING) inside the sign-up transaction; retries cannot duplicate. Existing users are backfilled.
- Workspace/membership FKs to `auth.users` intentionally have no cascade: user deletion fails until the pending data-deletion decision is made.
- App: sign-up/sign-in/sign-out, forgot/update password (`/update-password`), session restore via `INITIAL_SESSION`, `RequireAuth`/`GuestOnly` guards, display name in the shell, TanStack cache cleared on sign-out. All UI text in `id.json`.
- Verification: `npx supabase test db` (40 pgTAP: provisioning, idempotency, two-user isolation incl. guessed IDs, roles, anon), Vitest 21 (incl. supabase-js integration, skipped without a local stack), manual browser run of every flow incl. Mailpit reset link.
- Profile editing: `/settings` updates `display_name` (trimmed, 1–80 chars; a 0-row update is reported as a failure); shell name refreshes via the shared `useProfile` query.
- Not done: OAuth (pending decision), household co-member visibility (G5), CI.

## 12. G0 visual/accessibility review (2026-11-24)

- Checked Dashboard, a placeholder page and Settings at desktop and 375 px: `lang="id"`, one `h1` per page, labelled navs, every control named, no horizontal scroll, no small touch targets.
- Fixed: focus outline `--focus` (#2F6FC0, 5.05:1; dark #78A9E8); input border `--field` (3.8:1) with a focus border/ring; `--muted` #5E7066 (4.85:1 on canvas); removed the non-functional Search/Notifications buttons; phones reach Budgets/Goals/Debts/Reports through "Menu lainnya" on Settings (links shared in `src/app/navigation.ts`).
- Remaining: Cloudflare preview review (needs a deployment, G7), dark mode is not enabled anywhere yet, Budgets and Reports share an icon, per-page document titles and a skip link.

## 13. G2a ledger database (2026-11-25)

- Migrations `20261125100000`–`100300`: currencies; ledger core (ledger/financial accounts, categories, income sources, transactions, journal entries/lines, idempotency, audit; immutability and deferred balance triggers; RLS and column grants; system accounts + 12 default categories on provisioning, backfilled); posting RPCs (`create_financial_account`, `set_financial_account_archived`, `post_income`, `post_expense`, `post_transfer`, `post_refund`, `reverse_transaction`, `edit_transaction`); read models (`account_balances`, `transaction_feed`, `period_totals`), money as text.
- Deviation, approved spec intent: an edit that changes only category, income source or note updates in place (dimensions, D-09); other edits reverse and repost.
- Verified: `npx supabase db reset` from empty plus `npx supabase test db`, 118 pgTAP tests (worked example, D-14/D-15 guards, idempotency incl. replay and conflict, edits, reconciliation, two-user isolation, viewer and anon, immutability). Reviewed twice by architecture-reviewer; all findings fixed.
- Not done yet: two-session concurrency tests (double refund, archive vs post, duplicate key), the transactions/accounts UI.
