# POCKA Phase 0B — Application Foundation

**Status:** Initial application shell merged into `main` via PR #5; local install, verification and code review completed.

## Included
- React + TypeScript + Vite SPA with strict TypeScript settings.
- npm scripts and committed `package-lock.json` generated with npm install.
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
2. Run `npm ci` for a reproducible install; use `npm install` only when changing dependencies and the lockfile.
3. Copy .env.example to .env.local only after a development Supabase project is configured; values are blank.
4. Run npm run dev.
5. Run npm run typecheck, npm test, npm run lint and npm run build.

Review package compatibility and Cloudflare Vite integration against current official documentation before enabling deployment.
