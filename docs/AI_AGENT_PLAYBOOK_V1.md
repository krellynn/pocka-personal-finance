# POCKA V1 — AI Agent Playbook

**Status:** Proposed operating procedure, consistent with DEVELOPMENT_GUIDELINES.md §10.  
**Purpose:** Coordinate ChatGPT, Codex, Claude Code or other coding agents without conflicting changes or silent product decisions.

## 1. Mandatory reading before any implementation

Every agent must read:
1. `README.md`
2. `PROJECT_STATUS.md`
3. `docs/DECISION_REGISTER.md`
4. Relevant ADRs in `docs/decisions/`
5. `PRODUCT_OVERVIEW.md`
6. `ARCHITECTURE.md`
7. `DATABASE_SPECIFICATION.md`
8. `HOUSEHOLD_PRIVACY.md`
9. `DEVELOPMENT_GUIDELINES.md`
10. Relevant V1 package documents and current code/migrations.

An agent must inspect git status, branch, files and existing tests before editing.

## 2. Agent roles

### Product/Architecture agent
- Converts approved requirements into bounded tasks.
- Maintains traceability, decisions and contracts.
- Flags conflicts and unresolved product choices.
- Does not write application code unless separately assigned.

### Frontend agent
- React screens, components, forms, routing, accessibility and client-side schemas.
- Uses feature API adapters; never calls Supabase from generic UI components.
- Does not invent database fields or financial semantics.
- May use typed mock adapters only when clearly isolated and labelled.

### Database/Backend agent
- ERD, migrations, constraints, RLS, RPC, views and generated types.
- Owns migration ordering and serialization.
- Must include database tests for each table/policy and financial mutation.
- Never weakens RLS to make UI work.

### Finance domain agent
- Reviews chart of accounts, posting matrix, money precision, FX, debt and settlement semantics.
- Supplies worked examples and invariant tests.
- Does not approve product decisions on behalf of the owner.

### QA agent
- Writes unit, integration, RLS/privacy and E2E tests.
- Tests adversarial cases and regression paths.
- Reports evidence, not assumptions.

### Reviewer/integration lead
- Reviews diffs, contracts, dependency changes, secrets and tests.
- Ensures only one agent owns shared migrations/contracts at a time.
- Blocks merges that violate ADRs or quality gates.

Roles may be performed by one or multiple AI sessions. The product owner remains final approver.

## 3. Task assignment contract

Every task request must contain:
- Task ID and milestone.
- Objective and user value.
- Source requirements/ADR links.
- In-scope files/modules.
- Explicit out-of-scope files/modules.
- Dependencies and required contracts.
- Acceptance criteria.
- Required tests and verification commands.
- Security/financial risk level.
- Branch name and expected PR title.
- Handoff format.

If any required input is missing or ambiguous, the agent must ask or document a blocking question rather than invent behaviour.

## 4. Branch and file ownership

- Use short-lived branches: `feat/<task>`, `fix/<task>`, `test/<task>`, `docs/<task>`.
- One owner for shared migrations and database contract files.
- One owner for global tokens, router and shared shell at a time.
- Feature agents own only their feature folder unless a coordinated change is approved.
- Do not have multiple agents commit to the same branch concurrently.
- Do not rebase/force-push shared branches without coordination.
- PR required; CI and review required before merge.
- Do not commit or push unless product owner has authorized that workflow.
- No production deployment without explicit approval.

## 5. Financial and security stop conditions

Stop and report if:
- An approved ADR conflicts with implementation.
- A transaction type lacks a posting matrix.
- Money would use JavaScript floating point.
- A posted record would be updated/deleted.
- An operation lacks idempotency/concurrency strategy.
- A query could expose private data or bypass RLS.
- A service-role key or secret is requested in browser code.
- A cross-workspace reference is not explicitly authorized.
- A migration is destructive or irreversible without approval.
- A requirement needs a pending product decision.

Never "fix" an authorization problem by broadening policies. Never use production data for test fixtures.

## 6. Definition of Done for an agent task

The agent must return:
1. Summary of changes.
2. Files changed.
3. Requirement/ADR traceability.
4. Tests added and commands run.
5. Test results (pass/fail with relevant output).
6. Security/financial invariants considered.
7. Known limitations and deferred decisions.
8. Migration/deployment impact.
9. PR/branch reference.
10. Confirmation that no out-of-scope changes were made.

"Implemented" is not equivalent to "verified". Report unverified items explicitly.

## 7. Prompt template

Use this template for each assigned task:

```text
You are working on POCKA. Before editing, read README.md, PROJECT_STATUS.md,
DECISION_REGISTER.md, relevant ADRs, DEVELOPMENT_GUIDELINES.md and the
task's referenced specifications. Inspect the current branch, git status,
code and tests.

Task ID:
Milestone:
Objective:
Requirements/ADRs:
Dependencies/contracts:
Allowed files:
Forbidden files:
Acceptance criteria:
Required tests:
Verification commands:
Risk level:
Expected handoff:

Do not invent product decisions or schema/API fields. Do not override an
approved ADR. Do not weaken RLS or financial invariants. Do not use
floating-point money. Do not modify posted ledger facts. Do not run
destructive migrations or deploy. If blocked, stop and report the exact
question and impact. Make the smallest coherent change and provide test
evidence.
```

## 8. Multi-agent coordination rules

- Maximum 2–3 active implementation streams at a time for the current solo operator/review capacity.
- Use separate branches/worktrees and isolated file ownership.
- A shared contract change must be proposed by the owning agent, reviewed, merged, then consumed by dependent agents.
- No speculative migration in a feature branch when the canonical schema is still changing.
- UI can be scaffolded with typed fixtures, but must switch to real adapters only after the contract is approved.
- Integrate at least weekly; run cross-feature tests after integration.
- If conflicts arise, pause dependent tasks; do not resolve by silently choosing one implementation.

## 9. No-code boundary before approval

This playbook does not authorize implementation. Coding starts only after G0 in `PARALLEL_EXECUTION_PLAN_V1.md` is approved and the product owner explicitly authorizes Phase 0B. Until then, only documentation review and planning changes are in scope.
