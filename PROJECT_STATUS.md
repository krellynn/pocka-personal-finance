# POCKA — Project Status

**Last updated:** 2026-11-13
**Current phase:** Phase 0, Documentation & Architecture Foundation. V1 architecture decisions ADR-001 to ADR-013 are **approved** (2026-11-13) and documented. Awaiting product-owner approval to start the application foundation phase.

---

## 1. Last Verified Git Baseline

| Item | Value |
|---|---|
| Branch | `main` (tracking `origin/main`) |
| Latest commit | `122b3bb` "Initial POCKA prototype and gitignore" |
| Previous commit | `f841ead` "Initial commit" |
| Remote | `origin` → `https://github.com/krellynn/pocka-personal-finance.git` |
| Working tree at start of Phase 0A | Clean |

All Phase 0 documentation (Phase 0A plus the 2026-11-13 decision update) is **uncommitted** until the product owner approves it.

---

## 2. Implementation Status Summary

| Component | Status |
|---|---|
| Product & architecture documentation | **Drafted** (pending review) |
| Architecture decisions (ADR-001 to ADR-013) | **Approved and documented** in `docs/DECISION_REGISTER.md` and `docs/decisions/` |
| Static design prototype (`index.html`, root) | **Exists** (demo only). Relocation to `prototype/index.html` is **planned** for the Vite foundation phase (ADR-012), **not yet done** |
| React/Vite application | **Not started** |
| Dependencies / `package.json` | **Not started** |
| Supabase project, Auth, database | **Not started** |
| SQL migrations / RLS policies | **Not started** |
| Double-entry ledger | **Not started** (specified only) |
| Household workspace & privacy | **Not started** (specified only) |
| Multi-currency | **Not started** (specified only) |
| Import / reconciliation | **Not started** (specified only) |
| Tests | **None** |
| Vercel deployment | **Not started** |
| CI | **None** |

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

These are documented only. **Phase 0A does not modify `index.html`.** They must not be carried into the real app.

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

1. **Documentation review**: product owner reviews `docs/`, including the Decision Register and ADRs.
2. **Phase 0B — Application Foundation.** It starts only after explicit approval: scaffold, move the prototype to `prototype/index.html` (ADR-012), design tokens, i18n with Bahasa Indonesia default (ADR-011), money/date helpers (ADR-001), Supabase Auth, profiles, personal workspace.
3. **Design reviews** for the implementation details listed in ARCHITECTURE §9.3, scheduled before the phase that needs each one.

---

## 7. Decisions and Open Questions

**Resolved on 2026-11-13** by ADR-001 to ADR-013 (see `docs/DECISION_REGISTER.md`): money storage, pocket model and Unallocated, shared summary (empty), recurring drafts, contribution accounting, FX recognition, credit cards, account archiving, household exit, split methods, UI language, prototype location, privacy invariants.

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
