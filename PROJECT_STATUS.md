# POCKA — Project Status

**Last updated:** 2026-11-21  
**Current phase:** Phase 0A — Documentation & Architecture Foundation. **Complete and merged into `main`.** ADR-001 to ADR-013 were approved on 2026-11-13; ADR-014 (Cloudflare Workers + Static Assets hosting) was approved on 2026-11-21 and merged through PR #3. **Phase 0B — Application Foundation & Authentication has not started.**

**Planning update:** A proposed V1 Master Development Package (functional specification, domain/API contract plan, UX/design system, quality strategy, parallel execution plan, AI agent playbook, product-owner decision backlog and Database & Finance Architecture Design Pack) is prepared on branch `docs/master-development-package-v1` for review. This is documentation only. It does not mean the application or Phase 0B has started.

---

## 1. Last Verified Git State

| Item | Value |
|---|---|
| `main` (origin) | PR #3 merged; ADR-014 and post-merge status sync present (verified 2026-11-21) |
| Completed PR | [PR #1](https://github.com/krellynn/pocka-personal-finance/pull/1), Phase 0A docs, merged |
| Completed PR | [PR #3](https://github.com/krellynn/pocka-personal-finance/pull/3), Cloudflare hosting ADR, merged |
| Remote | `origin` → `https://github.com/krellynn/pocka-personal-finance.git` |
| Planning branch | `docs/master-development-package-v1` — proposed documentation package, pending review |

The Phase 0A documentation and ADR-001 to ADR-014 are merged into `main`. No application code was changed by those documentation PRs.

---

## 2. Implementation Status Summary

| Component | Status |
|---|---|
| Product & architecture documentation | **Phase 0A complete** |
| Architecture decisions (ADR-001 to ADR-014) | **Approved and merged** |
| Static design prototype (`index.html`, root) | **Exists**; relocation to `prototype/index.html` planned, not done |
| React/Vite application | **Not started** |
| Dependencies / `package.json` | **Not started** |
| Supabase project, Auth, database | **Not started** |
| SQL migrations / RLS policies | **Not started** |
| Double-entry ledger | **Not started** (specified only) |
| Household workspace & privacy | **Not started** (specified only) |
| Multi-currency | **Not started** (specified only) |
| Import / reconciliation | **Not started** (specified only) |
| Tests | **None** |
| Cloudflare Workers hosting/deployment | **Not started**; platform approved by ADR-014 |
| CI | **None** |
| Master Development Package | **Prepared as proposed documentation on planning branch; pending product-owner review** |

Nothing in the target architecture is implemented yet. All financial-engine, privacy, database and Master Package content is specification/planning, not built behaviour.

---

## 3. Existing Prototype

The root `index.html` is a static HTML/CSS/vanilla-JS prototype using localStorage demo data. It is a UX reference only. Its known limitations and bugs are documented in the original Phase 0A status history and must not be carried into the real app.

ADR-012 requires moving it with `git mv` to `prototype/index.html`, unchanged, when the Vite foundation is introduced. It has not been moved.

---

## 4. Next Milestones

1. Review and approve the proposed Master Development Package on `docs/master-development-package-v1`.
2. Resolve or formally defer the product-owner decisions that block the next dependency gate.
3. Review and approve the Database & Finance Architecture Design Pack; resolve G0/G2 decisions including final CoA, posting matrix, ERD, RPC contracts, RLS matrix, pocket eligibility and FX method before financial migrations.
4. Obtain explicit product-owner authorization to start Phase 0B implementation.
5. Only then begin application foundation, Supabase local setup and Cloudflare configuration.

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
| 2026-11-21 | Planning | Added Database & Finance Architecture Design Pack (conceptual ERD, CoA, posting, RPC, RLS, FX, household and migration plan) to the same draft PR; all unresolved decisions remain pending and no implementation is authorized. |
