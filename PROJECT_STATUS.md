# POCKA — Project Status

**Last updated:** 2026-11-22  
**Current phase:** Phase 0B — Application Foundation. Phase 0A is complete and merged into `main`. The initial React/Vite scaffold is on `feat/phase-0b-application-foundation` in draft [PR #5](https://github.com/krellynn/pocka-personal-finance/pull/5); lockfile generation and local verification remain outstanding. PR #4 is the separate draft documentation package and is not merged.

**Planning update:** The V1 Master Development Package and Database & Finance Architecture Design Pack are prepared on `docs/master-development-package-v1` for review in draft PR #4. This branch is documentation-only. Approved decisions are recorded as such; detailed G2/G5/G6/G7 contracts and implementation gates remain in force.

---

## 1. Last Verified Git State

| Item | Value |
|---|---|
| `main` (origin) | PR #3 merged; ADR-014 and post-merge status sync present (verified 2026-11-21) |
| Completed PR | [PR #1](https://github.com/krellynn/pocka-personal-finance/pull/1), Phase 0A docs, merged |
| Completed PR | [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3), Cloudflare hosting ADR, merged |
| Remote | `origin` → `https://github.com/krellynn/pocka-personal-finance.git` |
| Planning branch | `docs/master-development-package-v1` — documentation package in draft PR #4, pending review |

The Phase 0A documentation and ADR-001 to ADR-014 are merged into `main`. The initial Phase 0B application scaffold is isolated on draft PR #5; neither PR #4 nor PR #5 is merged.

---

## 2. Implementation Status Summary

| Component | Status |
|---|---|
| Product & architecture documentation | **Phase 0A complete** |
| Architecture decisions (ADR-001 to ADR-014) | **Approved and merged** |
| Static design prototype (`prototype/index.html`) | **Moved unchanged** on PR #5 feature branch; not yet merged |
| React/Vite application | **Initial scaffold created on draft PR #5; local verification pending** |
| Dependencies / `package.json` | **Manifest created on PR #5; package-lock.json still required** |
| Supabase project, Auth, database | **Not started** |
| SQL migrations / RLS policies | **Not started** |
| Double-entry ledger | **Not started** (specified only) |
| Household workspace & privacy | **Not started** (specified only) |
| Multi-currency | **Not started** (specified only) |
| Import / reconciliation | **Not started** (specified only) |
| Tests | **Initial unit tests added on PR #5; execution pending** |
| Cloudflare Workers hosting/deployment | **Wrangler Static Assets config scaffolded on PR #5; no account setup or deployment** |
| CI | **None** |
| Master Development Package | **Prepared as proposed documentation on planning branch; pending product-owner review** |

Only the initial frontend foundation is scaffolded on PR #5 and remains unmerged/unverified locally. Financial-engine, privacy, database and Master Package content remains specification/planning, not built behaviour.

---

## 3. Existing Prototype

The root `index.html` is a static HTML/CSS/vanilla-JS prototype using localStorage demo data. It is a UX reference only. Its known limitations and bugs are documented in the original Phase 0A status history and must not be carried into the real app.

ADR-012 requires preserving the prototype byte-for-byte at `prototype/index.html`. This relocation is complete on PR #5's feature branch (blob SHA `cedf21040191bb93c4cfa4ddcdce4d9c6c8e0f07`) and is not yet merged.

---

## 4. Next Milestones

1. Complete review of draft PR #4 documentation and verify cross-document decision/status consistency.
2. Complete PR #5 foundation validation: generate and commit `package-lock.json`, run install/typecheck/lint/tests/build, and resolve any failures.
3. Review the PR #5 app shell, responsive/accessibility behaviour and Cloudflare preview configuration before any deployment.
4. Complete G2 design deliverables before financial migrations or ledger implementation; keep G5/G6/G7 gates separate.
5. Do not merge or deploy either PR without the required review and explicit release approval.

---

## 5. Pending Product-Owner Decisions

See [`docs/PRODUCT_OWNER_DECISIONS_V1.md`](docs/PRODUCT_OWNER_DECISIONS_V1.md) on the proposed planning branch for the complete decision backlog. The previously recorded pending decisions remain:
- Whole-user/workspace data deletion vs. immutable ledger.
- Household base currency when members' base currencies differ.
- Auth providers beyond email.
- Notification channels beyond in-app.

Implementation design reviews remain listed in `docs/ARCHITECTURE.md` §9.3 and are expanded in the V1 decision backlog.

---

## 6. Change Log

| Date | Phase | Change |
|---|---|---|
| 2026-11-13 | 0A | Created README, PROJECT_STATUS and Phase 0A documentation. |
| 2026-11-13 | 0A | Approved and merged ADR-001 to ADR-013. |
| 2026-11-21 | 0A | Approved and merged ADR-014 for Cloudflare Workers + Static Assets. |
| 2026-11-21 | Planning | Prepared proposed V1 Master Development Package on `docs/master-development-package-v1`; documentation only; no app code, dependencies, migrations, cloud resources or deployment. |
| 2026-11-21 | Planning | Added Database & Finance Architecture Design Pack (conceptual ERD, CoA, posting, RPC, RLS, FX, household and migration plan) to draft PR #4; approved decisions and remaining gate deliverables are distinguished. |
| 2026-11-22 | 0B | Initial React/Vite foundation scaffold created on feature branch and draft PR #5; local lockfile/toolchain checks remain outstanding. |


## 7. Architecture review remediation (2026-11-21)

PR #4 remains an open draft documentation PR. The 12 review findings have been addressed at design level and recorded in docs/ARCHITECTURE_REVIEW_REPORT_V1.md. No application code, dependencies, migrations, Supabase/Cloudflare resources, secrets or deployments were created.

This does not mean every design decision is approved. Category-vs-ledger mapping, FX carrying-value method/provider, pocket eligible funds, household base currency/role matrix, final column-level data dictionary, retention/deletion and operational objectives remain gated decisions/deliverables. D-09 category-as-dimension, D-10 baseline posting matrix, D-11 RPC-only financial mutation boundary, D-12 money wire format, D-13 SQL-view read model, D-14 archive policy, D-15 partial refunds, and D-16 pocket eligible-funds policy are recorded as approved in the decision register. Exact G2 implementation contracts and remaining FX/household decisions are still gated.

Phase 0B scaffold is on draft PR #5 and awaits local verification/review; it is not merged. Ledger implementation remains blocked by G2, household implementation by G5, and production by G7.
