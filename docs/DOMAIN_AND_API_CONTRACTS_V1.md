# POCKA V1 — Domain and API Contract Plan

**Status:** Proposed contract blueprint; not an executable schema or API implementation.  
**Purpose:** Establish stable boundaries so UI, database and test work can proceed in parallel without inventing incompatible assumptions.

## 1. Contract principles

1. PostgreSQL/Supabase is the source of truth for financial data.
2. Every workspace-owned record is scoped to one workspace.
3. Database constraints and RLS enforce ownership; UI state is not trusted.
4. Financial mutations are atomic, idempotent and auditable.
5. Posted ledger facts are immutable; corrections use reversal/repost.
6. Amounts are integer minor units in BIGINT; **all monetary JSON wire values are decimal integer strings in minor units, regardless of magnitude**, validated and parsed to TypeScript `bigint` (D-12 Option A approved 2026-11-21). Monetary JSON numbers are prohibited.
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
- SQL views/read models for balances, cash flow and reporting (D-13 Option A approved 2026-11-21); final view definitions and query catalogue remain design deliverables.

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

**Approved under D-13 Option A (2026-11-21):** SQL views are the initial read model for balances and reporting. Materialized views/caches are not the default; consider them only after measured performance evidence demonstrates a need and reconciliation tests verify consistency with the authoritative ledger. Final view definitions, query contracts, indexes and any future refresh strategy remain design deliverables.

## 7. Standard API behaviour

### Input/output
- Validate external payloads with Zod at the client boundary for UX and again at the trusted database/server boundary.
- Use explicit discriminated operation types; avoid ambiguous generic transaction payloads.
- Monetary wire representation: every monetary value is a base-10 decimal integer string in minor units, regardless of magnitude; validate and parse to TypeScript `bigint`. Never encode money as a JSON number. Currency exponent is metadata-driven.
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


---

## 10. Contract clarifications from architecture review (2026-11-21)

### 10.1 Money wire format
**Approved by the product owner as D-12 Option A (2026-11-21):** All monetary JSON fields are base-10 decimal integer strings in minor units, not JSON numbers, regardless of magnitude. Validate then parse to TypeScript `bigint`. Currency exponent is metadata-driven and never assumed to be two. FX rates/ratios use decimal-safe contracts and arithmetic. Formatted currency strings are presentation-only.

### 10.2 Financial mutation status
RPC-only financial writes are approved under D-11 Option A (2026-11-21). Client roles receive no direct write grants to ledger/financial fact tables; RPCs validate `auth.uid()`, active membership, operation permission, ownership, same-workspace references, idempotency and audit requirements. Final grants, function security mode and executable tests remain G2 deliverables.

### 10.3 Idempotency envelope
Use (workspace_id, operation_name, idempotency_key) plus canonical request fingerprint. Identical retries replay the original result or durable in-progress state; a different fingerprint returns IDEMPOTENCY_CONFLICT. Concurrent calls serialize so only one posting effect occurs. Household pairs use pair-level and distinct side-level keys.

### 10.4 Reversal command
Reverse the complete posted journal-entry set for the original business transaction atomically. Only one successful reversal is allowed. Original rows remain unchanged; replacement is a separate linked transaction; reversal-of-reversal is rejected. Retries are idempotent.

### 10.5 Household contracts
Cross-workspace correlation uses opaque pair ID, per-side authorization/idempotency, durable per-side state, retry/reconciliation and audited compensation. No private source identifiers/rows are exposed through household reads. A departed member may use only an obligation-scoped endpoint bound to auth.uid(); ordinary household RLS remains revoked.

See design pack §§17.1–17.10. Pending product/finance decisions remain gated at G2/G5.


## 6. Approved financial mutation boundary — D-11

## 7. Account archive lifecycle — D-14

**Product-owner decision (2026-11-21): Option B approved.** Account archiving represents account closure. The archive operation must reject an account whose ledger-derived balance is nonzero in its own currency; the balance must first be cleared by a valid transfer or another approved closing transaction. Archiving must not create an implicit write-off or make a remaining asset/liability disappear from the ledger. Archived accounts are excluded from Total Active Account Balance and current Net Worth, reject new postings, and retain historical transactions and reports. Unarchive/reactivation permissions and flow remain to be designed. The eventual RPC signature, authorization, locking, audit and tests remain G2 deliverables; this decision does not authorize implementation.

**Approved by the product owner on 2026-11-21 (Option A).** Every balance-affecting financial mutation is invoked through a PostgreSQL RPC. Client-side code must not directly write ledger or other financial fact tables. Read operations remain RLS-protected and may use approved SQL views/read models.

## 9. Pocket eligible-funds and shortfall contract — D-16

**Product-owner decision (2026-11-21): Option A approved.** Eligible funds comprise active cash, bank and e-wallet balances; positive balances add and negative/overdraft balances reduce the aggregate. Exclude credit-card limits/available credit, receivables and archived accounts. Unallocated is derived as eligible funds minus total allocations and may be negative after spending; read models/UI must expose the shortfall. Allocation commands must reject any new allocation that increases an existing shortfall or makes total allocations exceed eligible funds; deallocation is allowed and pocket-to-pocket transfers preserve total allocation. Serialize eligibility check and allocation write atomically (workspace-level lock/control row or an equivalently proven mechanism). FX conversion remains blocked on D-18/D-19, and household/private fund scope remains subject to G5.

## 8. Refund command behaviour — D-15

**Product-owner decision (2026-11-21): Option A — Multiple Partial Refunds approved.** A posted original expense may have multiple separately posted, linked refund transactions over time, including a sequence of partial refunds or a single full refund. Each refund reduces the original expense; it is never classified as income. The refund command must lock the original transaction, calculate the remaining refundable amount from the original refundable amount less successful linked refunds, reject any amount above that remainder (`REFUND_EXCEEDS_ORIGINAL`), and enforce idempotency/concurrency and atomic journal posting. Refund is distinct from reversal/repost correction. Final RPC signature, exact refundable-amount rules for edge cases, multi-currency valuation, fees and alternate refund destinations remain G2 design deliverables. No implementation is authorized by this decision alone.

Each RPC contract must specify actor and workspace authorization (`auth.uid()` and active membership), operation-level permission, same-workspace reference validation, validated payload, canonical idempotency identity/fingerprint, concurrency/locking behaviour, atomic write boundary, audit behaviour, return schema and stable error codes. Database grants must deny direct client mutation of financial fact tables and narrowly grant EXECUTE only to the intended authenticated role(s). SECURITY DEFINER is not implied; if selected, it requires fixed `search_path`, strict internal authorization/identifier validation and restricted EXECUTE grants.

This decision approves the architectural boundary, not the final RPC catalogue, signatures, grants, function security mode, SQL or generated types. Those remain G2 deliverables; no implementation is authorized by D-11 alone.


### 10.6 Debt overpayment guard — D-17.1
**Product-owner decision (2026-11-21): Option A approved.** A debt-payment command must reject a total payment greater than the remaining amount due. It must not convert the excess into lender credit, a receivable/refundable balance or expense. Recalculate/validate the remaining obligation within the serialized posting boundary so concurrent repayments cannot collectively overpay the debt. The payment components must still sum exactly to the total (principal + interest + fee). Early settlement, schedule changes and detailed interest/fee behaviour remain pending under D-17. This records the product rule, not a final RPC signature or implementation authorization.


### 10.7 Early settlement — D-17.2
**Product-owner decision (2026-11-22): Option A approved.** Use the lender-provided/quoted payoff amount for early settlement. The user supplies the total and its components (remaining principal, interest, and applicable fee/penalty); component values must reconcile exactly to the total. POCKA must not independently invent an interest discount, penalty or payoff calculation without an approved rule and authoritative lender data. On successful posting of the full settlement, mark the debt settled and stop future installments. Preserve prior payment history. Schedule edits and detailed interest/fee rules remain pending. This is a product rule, not a final RPC signature or implementation authorization.
