# POCKA V1 — Domain and API Contract Plan

**Status:** Proposed contract blueprint; not an executable schema or API implementation.  
**Purpose:** Establish stable boundaries so UI, database and test work can proceed in parallel without inventing incompatible assumptions.

## 1. Contract principles

1. PostgreSQL/Supabase is the source of truth for financial data.
2. Every workspace-owned record is scoped to one workspace.
3. Database constraints and RLS enforce ownership; UI state is not trusted.
4. Financial mutations are atomic, idempotent and auditable.
5. Posted ledger facts are immutable; corrections use reversal/repost.
6. Amounts are integer minor units in BIGINT; wire values use decimal strings where JavaScript safe integer limits could be exceeded.
7. Currency precision is metadata-driven.
8. Date-only values use ISO `YYYY-MM-DD` strings; instants use RFC 3339 timestamps.
9. Supabase service-role access is never used by the browser.
10. Cross-workspace linking is allowed only for explicitly designed household paired entries and must not expose private source records.

## 2. Bounded contexts / module ownership

| Context | Owns | Must not own |
|---|---|---|
| Identity | Profile, session-facing user settings | Financial balances |
| Workspace | Workspace, membership, invitation, roles | Personal financial content |
| Ledger | Journal accounts, entries, lines, posting/reversal invariants | UI-specific summaries |
| Accounts | Financial account metadata and ledger-account mapping | Pocket allocation |
| Transactions | Draft/posted transaction intent and posting orchestration | Client-side authoritative balance |
| Classification | Categories and income sources | Journal posting authority |
| Pockets | Allocations and Unallocated calculation | Assets or cash movements |
| Planning | Budgets, goals, debt schedules, recurring rules | Bypass of ledger posting |
| Reporting | Read models and report aggregation | Mutating financial records |
| Household | Shared expenses, contribution, split, settlement, membership lifecycle | Reading members' private finances |
| Import | Upload, staging, mapping, duplicate review, import jobs | Direct ledger writes outside posting RPC |
| Notifications/Audit | In-app notices and append-only audit events | Private data disclosure |

Each feature folder may own UI, schemas, hooks and API adapters. Components do not call Supabase directly; only the feature API layer does.

## 3. Proposed entity inventory

The conceptual database specification remains authoritative for detailed candidates. Consolidate and approve the final schema before migration creation.

### Identity/workspace
- `profiles`
- `workspaces`
- `workspace_members`
- `workspace_invitations`
- `user_settings`
- `currencies`

### Ledger/accounts/transactions
- `ledger_accounts`
- `financial_accounts`
- `journal_entries`
- `journal_lines`
- `transactions`
- `transaction_reversals`
- `transaction_categories`
- `income_sources`
- `audit_logs`
- `idempotency_keys`

### Planning
- `pockets`
- `pocket_allocations`
- `budgets`
- `budget_categories`
- `financial_goals`
- `goal_milestones`
- `goal_contributions`
- `debts`
- `debt_installments`
- `debt_payments`
- `recurring_rules`
- `recurring_executions`
- `recurring_skips`

### FX/reporting
- `exchange_rates`
- `fx_conversions`
- database views/read models for balances, cash flow and reporting (exact approach requires design review).

### Household
- `shared_expenses` or approved transaction representation
- `shared_expense_splits`
- `shared_contributions`
- `contribution_payments`
- `household_settlements`
- `settlement_allocations`
- explicit sharing/projection entities only where required by approved privacy design.

### Import/operations
- `import_jobs`
- `import_rows`
- `import_mappings`
- `reconciliation_matches`
- notification and file metadata entities as needed.

Names are candidates, not approved final table names. Resolve overlaps in DATABASE_SPECIFICATION §4 before writing migrations.

## 4. Contract design deliverables required before coding

The following artifacts must be completed and reviewed:

1. Final ERD with cardinalities, ownership and lifecycle.
2. Data dictionary: columns, types, nullability, defaults, constraints, indexes and deletion/archive semantics.
3. Chart of accounts and account-type mapping.
4. Journal posting matrix with worked examples for every transaction class.
5. RPC contract catalogue with input/output schemas, error codes and idempotency semantics.
6. Read-query/view catalogue for balances, transaction lists, dashboard and reports.
7. RLS matrix: table × operation × workspace type × membership role × visibility scope.
8. Cross-workspace paired-entry design for contribution/reimbursable advance.
9. Migration sequence and rollback/forward-fix strategy.
10. Generated TypeScript type strategy and contract-test approach.

These are design outputs; this package does not claim they already exist.

## 5. Proposed RPC catalogue

Final names, signatures and payloads require design review. Do not implement directly from these illustrative names.

| Operation | Proposed RPC responsibility | Key invariant |
|---|---|---|
| `create_opening_balance` | Create account opening journal | Balanced, one-time/idempotent |
| `post_income` | Post income | Debit asset, credit income |
| `post_expense` | Post expense | Debit expense, credit asset/liability |
| `post_transfer` | Transfer between accounts | Debit destination, credit source; neutral to income/expense |
| `post_refund` | Refund original expense | Linked, bounded, offsets expense |
| `post_adjustment` | Approved adjustment | Auditable and balanced |
| `reverse_journal_entry` | Reverse posted journal | Immutable original, linked reversal |
| `post_credit_card_purchase` | Record purchase | Expense once, credit card liability |
| `post_credit_card_payment` | Pay card liability | Debit liability, credit bank; no second expense |
| `post_debt_disbursement` | Record loan proceeds | Debit asset, credit liability; not income |
| `post_debt_payment` | Split principal/interest/fee | Exact component sum; principal reduces liability |
| `create_pocket_allocation` | Allocate eligible funds | No journal entry, never exceeds eligibility |
| `confirm_recurring_draft` | Convert reviewed draft to posting | Same posting invariants, idempotent |
| `post_fx_conversion` | Record actual conversion | Frozen rate snapshot, realized FX only |
| `create_shared_expense` | Create household expense and split | Sum shares exactly to total |
| `record_contribution_payment` | Record actual payment | Commitment not cash; correct intent |
| `settle_household_obligation` | Clear payable/receivable | No duplicate income/expense |
| `commit_import_rows` | Post reviewed import rows | Uses same posting functions, partial commit rules |

No RPC signature is approved by this document. Every mutation must define authorization, validation, transaction boundaries, idempotency key, concurrency strategy, audit event and stable error contract.

## 6. Query/read-model catalogue

Proposed read interfaces:
- Workspace membership and accessible workspace list.
- Financial account list/detail and ledger-derived balance.
- Transaction list/detail with pagination, filtering and date range.
- Pocket allocations and computed Unallocated.
- Budget planned/actual/progress.
- Goal progress.
- Debt outstanding principal and payment schedule.
- Recurring rules and draft occurrences.
- Dashboard summary.
- Cash-flow, category/source, net-worth and debt reports.
- Household shared expense, contribution and settlement views restricted by RLS.
- Import job and row review state.
- Audit and notification inbox.

Read models may use SQL views initially (proposal P-04). Materialized views/caches require measured performance evidence and reconciliation tests.

## 7. Standard API behaviour

### Input/output
- Validate external payloads with Zod at the client boundary for UX and again at the trusted database/server boundary.
- Use explicit discriminated operation types; avoid ambiguous generic transaction payloads.
- Monetary wire representation: decimal integer strings in minor units (subject to contract approval); never JSON floating-point values for money.
- IDs: UUID strings.
- Date-only: `YYYY-MM-DD`.
- Timestamp: RFC 3339 with timezone offset/UTC marker.
- Paginated list responses define stable ordering and cursor/limit behaviour.

### Error taxonomy (proposed)
- `AUTH_REQUIRED`
- `WORKSPACE_ACCESS_DENIED`
- `ROLE_INSUFFICIENT`
- `VALIDATION_FAILED`
- `CURRENCY_PRECISION_INVALID`
- `INSUFFICIENT_ELIGIBLE_FUNDS`
- `IDEMPOTENCY_CONFLICT`
- `RESOURCE_ARCHIVED`
- `POSTED_ENTRY_IMMUTABLE`
- `REFUND_EXCEEDS_ORIGINAL`
- `SPLIT_TOTAL_MISMATCH`
- `FX_SNAPSHOT_REQUIRED`
- `IMPORT_ROW_NOT_REVIEWED`
- `CONCURRENT_MODIFICATION`

Error messages shown to users must be localised and must not reveal private record existence or authorization internals.

## 8. Security and RLS contract

- Deny by default.
- RLS on every user/workspace-owned table in the same migration as table creation.
- Active membership required for workspace-scoped access.
- Role permissions are separate from record visibility.
- Private personal records are never readable by household owner/admin merely through membership.
- Shared records are only visible through approved shared entities/projections.
- `shared_summary` remains empty.
- Immediate revocation after leave/remove.
- Same-workspace composite references/constraints wherever possible.
- Security-definer functions use fixed search_path, explicit auth.uid checks and least privilege.
- No service-role key in frontend.
- P1–P20 privacy acceptance tests are release blockers for household.

The final RLS matrix must be approved before migrations are written.

## 9. Contract versioning and parallel work

- Shared contracts live in version-controlled docs and, after approval, generated types/schema artifacts.
- A contract change requires a change note, impacted modules, migration implications and test updates.
- One designated integration owner controls shared migrations and shared API contract changes.
- Feature agents may build isolated UI against mock adapters only when payload shapes are explicitly marked provisional.
- Do not merge a feature whose assumed schema or authorization semantics conflict with approved contracts.
- Breaking changes require coordinated updates across database, API adapter, UI and tests.

## 10. Required design reviews

Blocking before relevant implementation:
- Final chart of accounts and journal mapping before ledger mutation code.
- Pocket eligible-funds definition before allocation enforcement.
- FX carrying-value method and rate provider before multi-currency posting.
- Household base currency rule before household multi-currency reporting.
- Cross-workspace paired entry and departed-member settlement access before household posting.
- Role/permission matrix before invitations and household write actions.
- Whole-user/workspace deletion policy before account closure/deletion functionality.
- Import format, parser, limits, storage policy and retention before import implementation.
