# ADR-014 — Cloudflare Workers + Static Assets Hosting

- **Status:** APPROVED
- **Date:** 2026-11-21
- **Decision owners:** POCKA product owner
- **Supersedes:** The Vercel frontend-hosting selection in BL-04 only. React + TypeScript + Vite SPA and GitHub source control remain approved.

## Context

POCKA's approved frontend stack is React + TypeScript + Vite, with Supabase as the backend, database, and authentication platform. The earlier baseline BL-04 selected Vercel for frontend hosting. The product owner has decided to use Cloudflare Workers with Static Assets instead.

## Decision

Host the POCKA frontend on **Cloudflare Workers using Static Assets**. The built Vite client application is delivered as static assets through the Workers platform. Vercel is no longer the approved frontend hosting platform for POCKA.

For the Vite application, the **stable Cloudflare Vite plugin** is the preferred integration direction. It builds the frontend assets for Workers deployment and integrates Vite with the Workers runtime. Re-check the stable plugin version and supported Vite compatibility during Phase 0B; do not pin unverified versions in this ADR. The plugin can generate the asset directory configuration from the client build, so avoid duplicating `assets.directory` unless a verified requirement calls for it.

Because POCKA is a React Router SPA, configure and test the Static Assets single-page-application fallback so direct navigation and browser refreshes on nested routes return the app shell.

## Responsibilities and boundaries

- **GitHub:** source control, branches, pull requests, and review.
- **Cloudflare Workers + Static Assets:** frontend hosting, static asset delivery, and deployment.
- **Supabase:** authentication, PostgreSQL database, Row Level Security, RPC, Storage, and approved backend functions.
- This ADR does not move database, authentication, or financial business logic from Supabase to Cloudflare.
- This ADR does not require custom Worker API routes. Add Worker runtime logic only for a separately approved requirement.

## Security

- Anything bundled into browser assets is public. Only intentionally public configuration, such as the Supabase project URL and publishable/anon key, may be exposed to the frontend.
- Supabase service-role credentials and all other secrets must never be bundled into client assets, committed to Git, or exposed in browser code.
- Any future Worker secrets must be configured server-side and must not be returned to the browser.

## Consequences

- Configure and verify the Cloudflare Vite plugin, Wrangler configuration (`wrangler.jsonc` or the supported equivalent), build output, SPA fallback/routing, compatibility date, and deployment scripts during Phase 0B. Verify the final generated build configuration rather than assuming the plugin's output layout.
- Workers Builds/GitHub integration and preview deployments are the proposed delivery workflow; confirm the exact branch and environment configuration before enabling it.
- Domain/DNS, production and preview environments, observability, rollback, Cloudflare plan selection, and operational access must be reviewed before deployment.
- No Cloudflare account, project, domain, deployment, application code, or environment configuration is created by this ADR.
- Supabase remains independent of the hosting provider.

## Alternatives considered

- **Vercel:** previously approved by BL-04; replaced by this ADR at the product owner's direction.
- **Cloudflare Pages:** not selected. The chosen target is Workers with Static Assets.
- **Self-hosted frontend:** not selected; adds operational responsibilities without a current product need.

## References

- [Cloudflare Workers Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Vite plugin — Static Assets](https://developers.cloudflare.com/workers/vite-plugin/reference/static-assets/)
- [Cloudflare SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)
- [Cloudflare migration guide from Vercel](https://developers.cloudflare.com/workers/static-assets/migration-guides/vercel-to-workers/)
