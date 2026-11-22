# POCKA — Project Status

**Last updated:** 2026-11-22  
**Current phase:** Phase 0B — Application Foundation (initial scaffold created on feature branch; pending install, local verification and PR review).

## Verified repository state
- main remains the Phase 0A documentation baseline.
- Documentation planning branch docs/master-development-package-v1 and draft PR #4 remain separate and unmerged.
- Feature work is isolated on feat/phase-0b-application-foundation.
- The original static prototype was moved unchanged from root index.html to prototype/index.html (ADR-012).
- React/Vite application scaffold is present on the feature branch.
- No Supabase project, Auth, database, migrations, RLS, ledger, RPCs, credentials or secrets have been created.
- No Cloudflare deployment, domain or production resources have been configured.

## Foundation scaffold
- React + TypeScript + Vite, strict TypeScript and npm scripts.
- Tailwind CSS with approved light palette; dark mode semantic values remain provisional.
- React Router, TanStack Query provider, i18next with Indonesian default.
- Responsive shell/navigation and explicit empty states (no fake financial figures).
- bigint minor-unit currency formatter and Asia/Jakarta date helper.
- Vitest baseline tests for money/date helpers.
- Wrangler static assets configuration with SPA fallback.

## Remaining before Phase 0B can be called complete
1. Run npm install and commit package-lock.json.
2. Verify dependency compatibility and Cloudflare Vite integration against current docs/toolchain.
3. Run typecheck, lint, tests and production build; fix all issues.
4. Complete visual/accessibility review of the shell and semantic tokens.
5. Complete approved Supabase Auth/profile/personal-workspace provisioning design and implementation in a development-only environment.
6. Add isolated preview deployment workflow only after Cloudflare account and environment setup are authorized.

## Gates and safety boundaries
- This scaffold does not authorize financial-core implementation. G2 remains mandatory before schema migrations, ledger, RPC or financial mutations.
- G5 remains mandatory before household features; G6 before import implementation; G7 before production readiness.
- Do not add mock balances or transactions that could be mistaken for real financial records.
- Do not create paid resources, configure secrets, deploy, merge to main, or modify prototype content without separate approval.
