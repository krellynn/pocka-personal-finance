# POCKA Phase 0B — Application Foundation

**Status:** Initial application shell scaffold on a feature branch; pending local install, verification and PR review.

## Included
- React + TypeScript + Vite SPA with strict TypeScript settings.
- npm scripts; generate and commit package-lock.json with npm install before merge.
- Tailwind CSS with approved light palette and provisional dark semantic variables.
- React Router, TanStack Query provider, i18next with Bahasa Indonesia default.
- Responsive shell/navigation and honest empty states; no fake financial balances or transactions.
- bigint minor-unit currency formatter using currency exponent metadata.
- Asia/Jakarta date-only helper that avoids UTC ISO date slicing.
- Vitest baseline for money and timezone helpers.
- Wrangler Static Assets SPA fallback configuration.

## Explicitly excluded
- Supabase project/Auth credentials/secrets.
- Database schema, migrations, RLS, ledger, RPC or financial mutations.
- Production deployment, domain/DNS, household, FX, import or debt calculations.

## Local setup
1. Install Node.js 20.19+.
2. Run npm install to generate package-lock.json; use npm ci on clean/CI environments.
3. Copy .env.example to .env.local only after a development Supabase project is configured; values are blank.
4. Run npm run dev.
5. Run npm run typecheck, npm test, npm run lint and npm run build.

Review package compatibility and Cloudflare Vite integration against current official documentation before enabling deployment.
