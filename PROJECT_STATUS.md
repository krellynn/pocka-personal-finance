# POCKA — Project Status

**Last updated:** 2026-11-22
**Current phase:** Phase 0B — Application Foundation. Initial React/Vite scaffold is on `feat/phase-0b-application-foundation` and draft PR #5; local verification and lockfile generation remain outstanding. Phase 0A remains complete on `main`.

---

## 1. Last Verified Git State

| Item | Value |
|---|---|
| `main` (origin) | Phase 0A documentation baseline; no application code merged |
| Completed PR | [PR #1](https://github.com/krellynn/pocka-personal-finance/pull/1), `docs/phase-0-architecture` → `main`, **merged** |
| Completed PR | [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3), `docs/cloudflare-workers-deployment` → `main`, **merged** |
| Remote | `origin` → `https://github.com/krellynn/pocka-personal-finance.git` |

The Phase 0A documentation and ADR-001 to ADR-014 are merged into `main`. Phase 0B work is isolated in draft PR #5; draft documentation PR #4 remains separate.

---

## 2. Implementation Status Summary

| Component | Status |
|---|---|
| Product & architecture documentation | **Phase 0A complete** and merged into `main` via PR #1 |
| Architecture decisions (ADR-001 to ADR-014) | **Approved and merged** into `main` via PR #1 and PR #3 |
| Static design prototype (`prototype/index.html`) | **Moved unchanged** on Phase 0B feature branch (ADR-012) |
| React/Vite application | **Initial scaffold created; pending local verification** |
| Dependencies / `package.json` | **Manifest created; lockfile not yet generated** |
| Supabase project, Auth, database | **Not started** |
| SQL migrations / RLS policies | **Not started** |
| Double-entry ledger | **Not started** (specified only) |
| Household workspace & privacy | **Not started** (specified only) |
| Multi-currency | **Not started** (specified only) |
| Import / reconciliation | **Not started** (specified only) |
| Tests | **Initial unit tests added; not yet executed** |
| Cloudflare Workers hosting/deployment | **Static Assets config scaffolded; no account/deployment configured** |
| CI | **Not configured** |

Nothing in the target architecture is implemented yet. All financial-engine, privacy, and database content in `docs/` is **specification**, not built behaviour.

---

## 3. Existing Prototype Capabilities (`index.html`)

A single-file static HTML/CSS/vanilla-JS prototype, about 27 KB. It is a design and UX reference only.

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

These are documented only. **Phase 0 does not modify `index.html`.** They must not be carried into the real app.

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

Everything in the target architecture: app scaffold, auth, workspaces, ledger, accounts, transactions, categories, income sources, pockets, budgets, goals, debt, recurring, multi-currency, household sharing and settlement, import/reconciliation, reports, notifications, audit logs, RLS policies, tests, CI, deployment. See `docs/ROADMAP.md`.

---

## 6. Next Milestones

1. **Phase 0B foundation scaffold**: see [draft PR #5](https://github.com/krellynn/pocka-personal-finance/pull/5). Remaining: npm lockfile, dependency/toolchain verification, tests/build/lint, visual/accessibility review, then Auth/profile/personal-workspace provisioning in an isolated development environment.
2. **G2 finance design**: complete CoA, posting rules, FX and debt calculations, RPC contracts, RLS, grants, data dictionary and migration plan before any ledger migrations or financial implementation.
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
| 2026-11-21 | 0 (documentation merge) | Merged PR #3 into `main` (squash commit `c804e33`); synchronized README, PROJECT_STATUS, and ROADMAP after merge. The initial Phase 0B scaffold is tracked separately in draft PR #5. |


## 9. Phase 0B foundation update (2026-11-22)

- Created the initial React + TypeScript + Vite app shell, Tailwind tokens, React Router, TanStack Query provider and Indonesian i18n catalogue on a separate feature branch.
- Added empty-state dashboard and module placeholders; no fake balances, transactions or demo financial records.
- Added bigint minor-unit currency formatter and Asia/Jakarta date helper with unit tests.
- Moved the original prototype to `prototype/index.html` unchanged (blob SHA `cedf21040191bb93c4cfa4ddcdce4d9c6c8e0f07`).
- Added Wrangler Static Assets SPA fallback configuration. No Cloudflare resources or deployment were created.
- Local install/test/build/lint were not completed in this execution. Generate package-lock.json and run all checks before merge. Draft PR #4 separately carries the V1 planning package and architecture review.
- No Supabase resources, Auth, schema, migrations, RLS, ledger or RPCs were created. G2 remains a hard gate.

## 10. V1 planning package status

- Draft PR #4 (docs/master-development-package-v1) contains the V1 Master Development Package, finance architecture design pack, product-owner decisions and architecture review remediation.
- The package records D-09 to D-16 approved decisions separately from remaining G2/G5/G6/G7 implementation deliverables.
- PR #4 and PR #5 remain separate draft pull requests. Neither is merged.
