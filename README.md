# POCKA

> Money, in your control.

POCKA is a personal finance web app focused on financial correctness, privacy, clarity and ease of use.

## Current status
Phase 0A documentation and architecture are complete. Phase 0B application foundation is being scaffolded on a separate feature branch. The original static prototype is preserved unchanged at prototype/index.html; it is a UX reference only, not production code.

## Stack
- React + TypeScript + Vite
- Tailwind CSS, Lucide icons, React Router
- TanStack Query for server state
- i18next + react-i18next (Bahasa Indonesia default)
- Supabase is the planned auth/database platform; no project or credentials are configured in this scaffold
- Cloudflare Workers + Static Assets is the approved hosting direction; no deployment is configured

## Local development
- Node.js 20.19+
- npm install (generates package-lock.json; use npm ci thereafter)
- npm run dev
- npm run typecheck
- npm test
- npm run lint
- npm run build

See docs/PHASE_0B_FOUNDATION.md and PROJECT_STATUS.md for scope and gates. No financial data is seeded or fabricated.
