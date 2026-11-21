# POCKA — Database Specification (Conceptual)

Status labels: **Approved** · **Proposed** · **Pending product-owner decision**.

> **This is a conceptual specification, not a migration.** No SQL in this document is to be executed. Table and column names are proposals to be finalised before any migration is written. **Approved decisions** ([DECISION_REGISTER](DECISION_REGISTER.md)) are binding. Names and shapes that implement them remain open to design review.

---

## 1. Conventions (Proposed)

- PostgreSQL schema `public` for app tables; `auth.users` is owned by Supabase Auth.
- Primary keys: `id uuid DEFAULT gen_random_uuid()`.
- Timestamps: `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz` where mutable.
- **Date-only business dates** (transaction date, due date): `date`, interpreted in the workspace timezone. Never derived from a UTC timestamp.
- **Money (Approved: [ADR-001](decisions/ADR-001-monetary-storage.md)):** every monetary amount and balance is `<name>_minor bigint` stored next to its `currency_code char(3)`. FX rates, ratios, and percentages are `numeric` (rates `numeric(20,10)`, precision subject to design review). The decimal exponent comes from `currencies.minor_units`.
- Every workspace-scoped table has `workspace_id uuid NOT NULL REFERENCES workspaces(id)`.
- Soft states via `status` enums, never physical deletion of posted financial data.
- Enumerations as Postgres enums or CHECK constraints (choice in Phase 2).
- Composite FKs `(workspace_id, id)` are **proposed** wherever a child must reference a parent in the *same* workspace, so the database itself rejects cross-workspace links.

## 2. Domain Overview

```
auth.users ─1:1─ profiles
     │
     └─< workspace_members >─ workspaces ─┬─< financial_accounts ─1:1─ ledger_accounts
                                          ├─< ledger_accounts (income/expense/equity/liability)
                                          ├─< transaction_categories (classification dimension; independent of ledger_accounts)
                                          ├─< income_sources
                                          ├─< transactions ─1:1─ journal_entries ─< journal_lines ─> ledger_accounts
                                          ├─< pockets ─< pocket_allocations
                                          ├─< budgets ─< budget_categories
                                          ├─< financial_goals ─< goal_contributions
                                          ├─< debts ─< debt_installments, debt_payments
                                          ├─< recurring_rules ─< recurring_executions
                                          ├─< import_jobs ─< import_rows
                                          └─ (household) shared_items, shared_contributions,
                                             shared_expense_splits, household_settlements
```

## 3. Entities by Domain

For each: purpose → key columns → keys/constraints → scoping and RLS.

### 3.1 Identity & Workspace

**profiles**: user display data.
- `id` (= `auth.users.id`, PK/FK), `display_name`, `avatar_url`, `created_at`.
- RLS: user reads and updates own row. Household co-members may read `display_name`/`avatar_url` only (via a restricted view, Proposed).

**workspaces**: personal or household container.
- `id`, `workspace_type` (`personal`|`household`), `name`, `base_currency` → currencies, `timezone` (default `Asia/Jakarta`), `locale` (default `id-ID`), `created_by`, `created_at`.
- Constraint: one `personal` workspace per user (enforced via partial unique index on `workspace_members(user_id)` where the workspace is personal and role = owner, or a `personal_owner_id UNIQUE` column, Proposed).
- RLS: members with `status = active` may read. Only `owner`/`admin` may update household settings.

**workspace_members**
- `workspace_id`, `user_id`, `role` (`owner`|`admin`|`editor`|`viewer`, Proposed), `status` (`invited`|`active`|`left`|`removed`), `joined_at`.
- PK `(workspace_id, user_id)`. A workspace must always have ≥ 1 owner (enforced in function).
- Index `(user_id, status)`.

**workspace_invitations**
- `id`, `workspace_id`, `email` or `invited_user_id`, `role`, `token_hash`, `expires_at`, `status`, `invited_by`.
- Unique pending invitation per `(workspace_id, email)`. Store only the token hash.

**user_settings**
- `user_id` PK, `theme` (`light`|`dark`|`system`), `locale`, `default_workspace_id`, notification preferences.
- RLS: own row only.

### 3.2 Currency

**currencies** (global reference): `code` PK (ISO 4217), `name`, `symbol`, `minor_units` (IDR 0, USD 2, JPY 0, …). Read-only for clients.

**exchange_rates**: `id`, `base_code`, `quote_code`, `rate numeric(20,10)`, `source`, `as_of timestamptz`, `fetched_at`. Unique `(base_code, quote_code, source, as_of)`. Global or workspace-specific manual rates (`workspace_id NULL` = global, Proposed).

**fx_conversions**: snapshot of the rate actually used for a posting: `id`, `workspace_id`, `from_code`, `to_code`, `rate`, `rate_source`, `rate_as_of`, `exchange_rate_id` (nullable). Referenced by journal lines. Frozen after posting (ADR-006).
For conversions and settlements, the posting also records **carrying value** and **settlement value** (base minor units). The difference posts to *Realized FX gain* / *Realized FX loss* ledger accounts. No unrealized revaluation entries in V1. The carrying-value method requires design review.
*Consolidation note:* could instead be columns on `transactions`/`journal_lines`. A separate table is kept for multi-leg FX transfers. **Proposed.**

### 3.3 Accounts & Ledger

**ledger_accounts** (chart of accounts per workspace)
- `id`, `workspace_id`, `type` (`asset`|`liability`|`equity`|`income`|`expense`), `subtype` (e.g. `cash`, `bank`, `ewallet`, `credit_card`, `loan`, `member_payable`, `member_receivable`, `household_receivable`, `member_contribution`, `fx_rounding`, `fx_gain`, `fx_loss`, `opening_balance`, `interest_expense`), `name`, `currency_code` (for asset/liability), `is_system`, `archived_at`.
- System accounts are created per workspace on creation (opening-balance equity, FX rounding, realized FX gain/loss, interest expense, …).
- Household workspace: one *Payable to member* (`member_payable`) per member, with `counterparty_user_id` (Proposed), plus member contribution funding accounts (`member_contribution`; account type requires design review, equity-style proposed) (ADR-005).
- Personal workspace: *Receivable from Household* (`household_receivable`, asset) per household the user belongs to (ADR-005).

**financial_accounts** (user-facing wallets)
- `id`, `workspace_id`, `ledger_account_id` UNIQUE, `kind` (`bank`|`ewallet`|`cash`|`credit_card`), `name`, `institution_name`, `masked_number` (last 4 digits only, optional), `currency_code`, `owner_user_id`, `visibility` (`private` default in personal; `shared` in household), `archived_at`.
- `credit_card` accounts are backed by a **liability** ledger account (subtype `credit_card`). Bill payment is an asset → liability transfer, **never an expense** (Approved: [ADR-007](decisions/ADR-007-credit-card-liability.md)). Statement cycles and rewards are out of V1.
- **Lifecycle (Approved: [ADR-008](decisions/ADR-008-account-archiving.md)):** an account with any journal lines is **never hard-deleted**, only archived (`archived_at`). Posting functions reject archived accounts. Archived accounts stay in historical reports. Delete is allowed only for accounts with no journal lines. FK `ON DELETE RESTRICT` plus a guard trigger backs this.
- **Never** stores credentials, full account numbers, PINs, or passwords.
- *Consolidation note:* `financial_accounts` is the UX layer over asset `ledger_accounts`. Keep both (Proposed) so categories, equity, and payables don't pollute the wallet list.

**transactions** (business event header)
- `id`, `workspace_id`, `type` (`income`|`expense`|`transfer`|`refund`|`adjustment`|`opening_balance`|`debt_disbursement`|`debt_payment`|`credit_card_payment`|`fx_conversion`|`household_contribution`|`household_advance`|`settlement`|`contribution_transfer`), `status` (`draft`|`posted`|`reversed`; **drafts have no journal lines and affect no balances or reports**, ADR-004; never-posted drafts may be deleted, ADR-008), `transaction_date date`, `description`, `category_id`, `income_source_id`, `counterparty`, `original_amount_minor`, `original_currency`, `fx_conversion_id`, `base_amount_minor`, `refund_of_transaction_id`, `recurring_execution_id`, `import_row_id`, `created_by`, `owner_user_id`, `visibility`, `idempotency_key`, `posted_at`.
- Secondary transaction-level uniqueness may use `(workspace_id, idempotency_key)`; canonical command idempotency is `(workspace_id, operation_name, idempotency_key)` plus request fingerprint (see §16).
- Indexes: `(workspace_id, transaction_date DESC)`, `(workspace_id, category_id, transaction_date)`, `(refund_of_transaction_id)`.
- Posted rows are immutable (trigger blocks updates to financial columns once `status = posted`, except `status → reversed` by the reversal function).

**journal_entries**: `id`, `workspace_id`, `transaction_id` (1:1, or 1:n for multi-step), `entry_date`, `posted_at`, `reverses_entry_id`.

**journal_lines**
- `id`, `journal_entry_id`, `workspace_id`, `ledger_account_id`, `direction` (`debit`|`credit`) **or** a signed amount (Proposed: `debit_minor`/`credit_minor` each ≥ 0, exactly one > 0), `original_amount_minor`, `original_currency`, `base_amount_minor`, `fx_conversion_id`, `memo`.
- Invariant: per `journal_entry_id`, Σ base debits = Σ base credits (deferred constraint trigger, checked at commit).
- Index `(ledger_account_id, entry_date)` (denormalised `entry_date`, Proposed) for balance queries.

**transaction_reversals**: `id`, `workspace_id`, `original_transaction_id` UNIQUE, `reversal_transaction_id`, `replacement_transaction_id` (nullable), `reason`, `reversed_by`, `reversed_at`.

**account_balances** (derived cache, optional): `ledger_account_id` PK, `balance_minor`, `currency_code`, `base_balance_minor`, `last_journal_line_id`, `updated_at`.
- Updated only inside posting functions. A reconciliation job and tests compare it to Σ journal lines.
- *Consolidation note:* V1 may compute balances via a view and skip the cache until performance requires it. **Proposed: start with a view.**

**transaction_attachments**: `id`, `workspace_id`, `transaction_id`, `file_id` → files_metadata. Same visibility as the parent transaction.

### 3.4 Categories & Income

**transaction_categories**: `id`, `workspace_id`, `kind` (`income`|`expense`), `name`, `icon` (Lucide name), `color`, `parent_id`, `is_system`, `archived_at`. Unique `(workspace_id, kind, lower(name), parent_id)`. **Approved D-09: categories are dimensions, not ledger accounts.** There is no `ledger_account_id` mapping. Categories classify transactions and support category-level budgets/reports; posting RPCs select stable ledger control accounts independently. Category lifecycle and historical reporting semantics must be finalized before ledger migrations.

System expense category **Household Contribution** (localised name, e.g. *Kontribusi Rumah Tangga*) exists in every personal workspace for contribution-intent payments (ADR-005).

**income_sources**: `id`, `workspace_id`, `name` (e.g. employer, client), `kind` (`employer`|`freelance_client`|`business`|`other`), `owner_user_id`, `visibility` (always `private` in personal), `archived_at`. Source ≠ category (Approved).

### 3.5 Pockets (Approved: workspace-level, [ADR-002](decisions/ADR-002-workspace-level-pockets.md))

**pockets**: `id`, `workspace_id`, `name`, `icon`, `color`, `target_amount_minor` (optional), `currency_code`, `goal_id` (nullable), `archived_at`. A pocket belongs to the **workspace** and has **no** `financial_account_id`.

**pocket_allocations**: movements into, out of, or between pockets. `id`, `workspace_id`, `pocket_id`, `amount_minor` (signed), `currency_code`, `allocation_date`, `source_type` (`manual`|`transaction`|`goal`|`recurring`), `transaction_id` (nullable; e.g. spending from a pocket), `counter_pocket_id` (for pocket-to-pocket), `created_by`, `idempotency_key`.
*Consolidation:* `pocket_transfers` is folded into `pocket_allocations` (paired rows sharing a `transfer_group_id`). **Proposed.**

**pocket_balances**: view = Σ allocations per pocket. No stored cache in V1 (Proposed).

**unallocated (view/function)**: per workspace, `eligible_funds_minor − Σ pocket balances`. It is **calculated, never stored as an asset or account**. Eligible-funds definition requires design review.

**Pocket invariants:** pocket rows never write `journal_lines`. Pocket totals are never added to asset or net-worth totals. Pocket balance = Σ its allocations. New allocations are rejected if Σ allocations would exceed eligible funds.

### 3.6 Budgets & Goals

**budgets**: `id`, `workspace_id`, `name`, `period_type` (`monthly` V1; others Pending), `period_start date`, `currency_code`, `status`.
**budget_categories**: `budget_id`, `category_id`, `planned_amount_minor`. PK `(budget_id, category_id)`.
**budget_adjustments**: `id`, `budget_id`, `category_id`, `delta_minor`, `reason`, `created_by`, `created_at` (audit of plan changes).
Budget actuals are **computed** from posted expense journal lines (net of linked refunds) in the period. They are never stored as editable numbers.

**financial_goals**: `id`, `workspace_id`, `name`, `target_amount_minor`, `currency_code`, `target_date`, `pocket_id` (nullable), `status`.
**goal_contributions**: allocation records toward a goal. If the goal links to a pocket, these are pocket allocations (consolidate: Proposed to use `pocket_allocations` with `goal_id` and drop this table).
**goal_milestones**: `id`, `goal_id`, `name`, `amount_minor`, `reached_at`.
Goal progress never inflates assets (Approved).

### 3.7 Debt

**debts**: `id`, `workspace_id`, `name`, `lender`, `kind` (`loan`|`installment`|`personal`; credit cards are **financial accounts**, not debts, per ADR-007), `liability_ledger_account_id`, `principal_minor`, `currency_code`, `interest_rate` (numeric, informational), `start_date`, `status`.
**debt_installments**: schedule. `id`, `debt_id`, `seq`, `due_date`, `principal_due_minor`, `interest_due_minor`, `status`. Unique `(debt_id, seq)`.
**debt_payments**: `id`, `debt_id`, `transaction_id`, `payment_date`, `total_minor`.
**debt_payment_allocations**: `debt_payment_id`, `installment_id` (nullable), `principal_minor`, `interest_minor`, `fee_minor`.
Invariant: `principal + interest + fee = total`. Posting: Dr liability (principal) + Dr interest expense (interest) + Dr fee expense / Cr cash (total).

### 3.8 Recurring

**recurring_rules**: `id`, `workspace_id`, `template` (type, amount, currency, account, category, description), `schedule` (RRULE-like or structured: frequency, interval, day), `start_date`, `end_date`, `status` (`active`|`paused`|`cancelled`), `next_occurrence_date`. **V1 always generates drafts** (Approved: [ADR-004](decisions/ADR-004-recurring-confirmation.md)). There is no auto-post mode in V1, so no `posting_mode` column is needed until a future auto-post capability is approved.
**recurring_executions**: `id`, `rule_id`, `occurrence_date`, `status` (`pending`|`drafted`|`posted`|`skipped`|`failed`), `transaction_id` (the draft, later posted), `attempts`, `last_error`. **Unique `(rule_id, occurrence_date)`**, which makes retries harmless. Missed occurrences are back-filled as drafts. Draft creation and status update are atomic. Failures are isolated per occurrence.
**recurring_skips**: consolidated into `recurring_executions.status = skipped` (Proposed; drop the table).

### 3.9 Import & Reconciliation

**import_jobs**: `id`, `workspace_id`, `file_id`, `financial_account_id`, `status` (`uploaded`|`parsed`|`mapping`|`reviewing`|`committing`|`completed`|`failed`), counts (`total`, `imported`, `skipped`, `failed`), `created_by`.
**import_mappings**: saved column mappings per user/account/format: `id`, `workspace_id`, `name`, `mapping jsonb`, `date_format`, `decimal_separator`.
**import_rows**: `id`, `import_job_id`, `row_number`, `raw jsonb`, parsed fields, `status` (`pending`|`valid`|`invalid`|`duplicate_suspect`|`approved`|`skipped`|`committed`|`failed`), `errors jsonb`, `transaction_id`, `dedupe_hash`. Unique `(import_job_id, row_number)`.
**reconciliation_matches**: `id`, `workspace_id`, `import_row_id`, `transaction_id`, `match_type` (`exact`|`probable`|`manual`), `confirmed_by`.
Rule: only rows the user approved are committed, each through the posting RPC with idempotency key `import:{job}:{row}`.

### 3.10 Household Sharing & Settlement

Full semantics are in `HOUSEHOLD_PRIVACY.md`.

**shared_items**: projection of a personal record into a household. `id`, `household_workspace_id`, `source_workspace_id`, `source_type`, `source_id`, `owner_user_id`, `scope` (`shared`|`shared_summary`), `shared_fields jsonb` (snapshot of **whitelisted** values only), `status` (`active`|`revoked`), `revoked_at`. The `shared_summary` whitelist is **empty** (ADR-003), so any `shared_summary` row with fields is rejected. `source_id` must never be readable or joinable by household members (ADR-013).
**shared_item_members**: optional narrowing to specific members (`shared_item_id`, `user_id`). Absent rows = all active members.
**shared_item_events**: audit of grant, update, and revoke.
**record_permissions**: *consolidation candidate*. In V1, visibility is expressed by `visibility` columns plus `shared_items`. A generic ACL table is **not** proposed for V1 unless a concrete need appears (Proposed: defer).

**shared_contributions** (commitments): `id`, `workspace_id` (household), `member_user_id`, `period_start`, `amount_minor`, `currency_code`, `status` (`open`|`partially_paid`|`paid`|`cancelled`). **Never** posts to the ledger.
**contribution_payments**: `id`, `contribution_id` (nullable, for ad-hoc), `member_user_id`, `payment_kind` (`transfer`|`direct_payment`), `funding_intent` (`contribution`|`reimbursable_advance`; transfers are always `contribution`), `transaction_id` (household ledger transaction), `amount_minor`, `currency_code`, `cross_workspace_link_id` (nullable; pairs with the member's personal entry without exposing it; design requires review). Contribution and reimbursable advance stay distinct end-to-end (Approved: [ADR-005](decisions/ADR-005-household-contribution-accounting.md)). Partial reimbursements reduce the payable incrementally.
**shared_expense_splits** (Approved methods: [ADR-010](decisions/ADR-010-expense-split-methods.md)): split header `transaction_id`, `method` (`equal`|`fixed`|`percentage`|`weighted`); participant rows `member_user_id`, `position` (order used for tie-breaks), `included bool`, `input_value numeric` (fixed amount, percentage, or weight), `share_minor bigint`. Invariants: Σ `share_minor` of included participants = expense amount; percentages sum to exactly 100; excluded participants have share 0; remainders by largest-remainder, ties by `position`.
**household_settlements**: `id`, `workspace_id`, `from_user_id`, `to_user_id` (or household), `amount_minor`, `currency_code`, `status` (`proposed`|`pending`|`completed`|`cancelled`), `transaction_id` (set on completion).
**settlement_allocations**: `settlement_id`, `target_type` (`payable`|`receivable`|`split`), `target_id`, `amount_minor`. Partial settlement is allowed; over-settlement is rejected.

**Membership exit (Approved: [ADR-009](decisions/ADR-009-household-membership-exit.md)):** setting `workspace_members.status` to `left`/`removed` revokes access immediately via RLS. No household financial row (transactions, contributions, payables/receivables, settlements, splits) is deleted or reassigned. Records keep `member_user_id` references for history.

### 3.11 System & Audit

**notifications**: `id`, `user_id`, `workspace_id`, `type`, `payload jsonb` (must not contain another member's private data), `read_at`. RLS: recipient only.
**audit_logs**: append-only. `id`, `workspace_id`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `created_at`. No UPDATE/DELETE for clients. Personal-workspace logs are visible only to that owner.
**idempotency_keys**: `workspace_id`, `key`, `operation`, `request_hash`, `result_ref`, `created_at`. PK `(workspace_id, key)`. *Consolidation:* may be replaced by unique `idempotency_key` columns on target tables (Proposed: use columns; keep the table only for multi-table operations).
**scheduled_jobs**: job run log (`job_name`, `run_key` UNIQUE, `status`, `started_at`, `finished_at`, `error`).
**files_metadata**: `id`, `workspace_id`, `bucket`, `path`, `mime_type`, `size_bytes`, `sha256`, `uploaded_by`, `purpose` (`import`|`attachment`).

## 4. Consolidation Summary (Proposed)

| Candidate | Proposal |
|---|---|
| `pocket_transfers` | Merge into `pocket_allocations` |
| `pocket_balances`, `account_balances` | Views first; cache tables only if needed |
| `goal_contributions` | Merge into `pocket_allocations` (with `goal_id`) when goal ↔ pocket |
| `recurring_skips` | Merge into `recurring_executions.status` |
| `record_permissions` | Defer; use `visibility` + `shared_items` |
| `idempotency_keys` | Prefer unique columns; table for composite ops |
| `transaction_categories` vs `ledger_accounts` | **Approved D-09: separate models; no 1:1 mapping and no merge.** Final CoA and category history semantics remain G2 design items |

All consolidations require product-owner/architect sign-off in a design review before the first ledger migrations (Phase 2).

## 5. Financial Invariants (must be enforced and tested)

1. **Balanced entries:** for every posted journal entry, Σ base debit = Σ base credit.
2. **Immutability:** posted transactions and their lines are never updated or deleted. Corrections use reversal.
3. **Single reversal:** a transaction can be reversed at most once (`UNIQUE original_transaction_id`).
4. **Workspace consistency:** every line's ledger account, category, pocket, and account belong to the transaction's workspace.
5. **Idempotency:** the same `(workspace_id, idempotency_key)` never posts twice.
6. **Recurring uniqueness:** one execution per `(rule_id, occurrence_date)`.
7. **No pocket double-counting:** pockets never appear in asset or net-worth totals.
8. **Transfers neutral:** transfers between own accounts change no income/expense totals.
9. **Debt split:** principal + interest + fee = payment total. Principal never hits expense accounts.
10. **Commitments are not cash:** `shared_contributions` never create journal lines.
11. **Settlement neutrality:** settlement entries touch only asset and payable/receivable accounts, never income or expense.
12. **Refund linkage:** a refund's amount ≤ the original's remaining refundable amount.
13. **Split totals:** Σ `shared_expense_splits.share_minor` = expense amount.
14. **FX history:** stored `fx_conversion` values never change after posting.
15. **Reconciliation:** any balance cache = Σ journal lines for that account.
16. **Positive amounts:** `amount_minor > 0` on lines and headers (direction carries the sign), except signed pocket allocations.
17. **Integer money (ADR-001):** all monetary columns are `bigint` minor units. No `float`/`real`/`double precision` columns for money anywhere.
18. **Allocation ceiling (ADR-002):** Σ pocket allocations ≤ eligible funds at allocation time. Unallocated is never stored as an asset.
19. **Drafts are inert (ADR-004):** draft transactions have no journal lines.
20. **Credit card payment neutrality (ADR-007):** card bill payments touch only asset and liability accounts, never expense.
21. **Contribution vs. advance (ADR-005):** `contribution` never creates a receivable or payable. `reimbursable_advance` never creates a personal expense. Reimbursement never creates an expense.
22. **Realized FX only (ADR-006):** FX gain/loss lines appear only on conversion or settlement entries. No unrealized revaluation entries.
23. **No hard delete with history (ADR-008):** accounts, categories, pockets, debts, and income sources referenced by journal lines cannot be deleted.
24. **Exit preserves records (ADR-009):** membership changes never delete or alter household financial rows.
25. **Empty shared summary (ADR-003):** no `shared_items` row with `scope = shared_summary` contains any field.

## 6. RLS Requirements

- RLS **enabled on every table** in §3 except global read-only references (`currencies`, global `exchange_rates`), which are read-only to authenticated users.
- Helper functions (Proposed): `is_active_member(workspace_id)`, `member_role(workspace_id)`, `can_view_record(workspace_id, owner_user_id, visibility)`.
- **Personal workspace:** only the owner, for all rows.
- **Household workspace:**
  - `shared` rows → all active members (SELECT); writes per role.
  - `private` rows in a household (e.g. a draft) → owner only.
  - `shared_summary` → only via `shared_items` projections, never the source row. The whitelist is **empty in V1** (ADR-003).
  - Members with `status` ≠ `active` (`invited`, `left`, `removed`) get **no** household access (ADR-009).
- **No policy may grant cross-workspace access** by joining through membership of a *different* workspace.
- Clients have **no direct INSERT/UPDATE/DELETE** on `transactions`, `journal_entries`, `journal_lines`, `transaction_reversals`, `household_settlements` (completion), `audit_logs`. Writes go via RPC (Proposed).
- Views exposed to clients use `security_invoker = true` (or are functions with explicit checks) so RLS of the caller applies.
- Each policy must have a matching automated test (see `HOUSEHOLD_PRIVACY.md` §9 and `DEVELOPMENT_GUIDELINES.md` §8).

## 7. Important Indexes (Proposed)

- `workspace_members (user_id, status)`
- `transactions (workspace_id, transaction_date DESC)`, `(workspace_id, status)`, unique `(workspace_id, idempotency_key)`
- `journal_lines (ledger_account_id, entry_date)`, `(journal_entry_id)`
- `pocket_allocations (pocket_id, allocation_date)`
- `recurring_executions` unique `(rule_id, occurrence_date)`; `recurring_rules (status, next_occurrence_date)`
- `import_rows (import_job_id, status)`, `(dedupe_hash)`
- `shared_items (household_workspace_id, status)`, unique `(household_workspace_id, source_type, source_id)` where active
- `audit_logs (workspace_id, created_at DESC)`
- `exchange_rates (base_code, quote_code, as_of DESC)`

## 8. Migration Strategy (Proposed)

1. All schema changes as **version-controlled SQL migrations** in `supabase/migrations/`. No dashboard edits.
2. Develop against a local Supabase (CLI) or a dedicated dev project. Never test against production data.
3. Migrations are **additive and reversible** where possible. Destructive changes (drop/rename/data rewrite) require explicit product-owner approval and a backup.
4. Order: reference data → identity/workspace → ledger core → categories/accounts → pockets/budgets/goals → debt → recurring → import → household → system.
5. Each migration ships with RLS policies **in the same migration** as its table (no window where a table exists without RLS).
6. Seed data: reference data (currencies, system categories) in migrations; demo data in a separate seed script for dev only, never applied to real users.
7. pgTAP (or equivalent) tests for constraints, invariants, and RLS run in CI before merge.

**No migrations are created in Phase 0A.**


---

## 16. Architecture review clarifications (2026-11-21)

1. **Idempotency:** the earlier unique (workspace_id, idempotency_key) is not the complete command identity. Use (workspace_id, operation_name, idempotency_key) with a normalized request fingerprint. Identical retries replay the original result/in-progress state; a different fingerprint returns IDEMPOTENCY_CONFLICT; concurrent duplicates serialize. A transaction-level unique key is only a secondary guard.
2. **Money wire format:** every JSON monetary amount is a decimal integer string in minor units, regardless of JavaScript safe-integer size. Parse to TypeScript bigint; never send monetary JSON numbers. Currency exponent comes from currencies.minor_units.
3. **Exchange-rate RLS:** global rows (workspace_id IS NULL) are authenticated read-only published data; client writes are denied and ingestion is server-controlled. Workspace manual rows are visible only to active members of that exact workspace and writable only through an authorized audited path. Use separate policies; no blanket authenticated-read policy.
4. **Category model (D-09 approved 2026-11-21):** categories are dimensions and are not mapped 1:1 to ledger accounts. Finalize historical rename/archive/reassignment behaviour before migrations; no hybrid model.
5. **Reversal:** reversal is transaction-scoped and reverses the complete posted journal-entry set atomically, with one successful reversal per original. Preserve original rows; replacement is a separate linked transaction; reversal-of-reversal is rejected.
6. **Data dictionary:** the entity list remains conceptual. G2 requires a complete table-by-table column/type/nullability/default/constraint/index/FK/RLS/write-path/lifecycle/retention/test dictionary before ledger migration.

See DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md §§17.1–17.13 for the table-level policy inventory, paired-entry recovery, contribution posting pair, and pocket/FX decision gates. This document is conceptual, not executable SQL.
