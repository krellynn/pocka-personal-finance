# POCKA — G2a Finance Core Design (Draft for Product-Owner Review)

**Status:** DRAFT, 2026-11-24, revised after an architecture review (12 findings applied). Nothing here is approved. No migration, RPC or ledger code may be written from this document until the product owner approves it (G2 gate) and answers §10.
**Builds on:** `DATABASE_AND_FINANCE_ARCHITECTURE_DESIGN_PACK_V1.md` (the "Design Pack"), approved decisions D-09 to D-16 and D-17.1–D-17.16, ADR-001 to ADR-014. Where this draft is more specific than the Design Pack it is a proposal, not an override.

## 1. Why a split gate (G2a)

The G2 gate approves the whole finance core at once, but three parts still depend on open decisions:

| Part | Blocked by |
|---|---|
| Multi-currency, FX conversion, realized gain/loss | D-18 (carrying-value method), D-19 (rate provider) |
| Debt schedules and payments | Remaining D-17 calculation detail |
| Adjustments | Reason-specific posting rules (D-10 note) |

**Proposal:** approve **G2a — single-currency personal finance core** now, and keep FX, debt and adjustments behind their own later approvals (G2b, G2c). G2a delivers a usable app: accounts, categories, income, expenses, transfers, refunds, credit cards, corrections, balances.

G2a scope:
- Personal workspaces only (household stays behind G5).
- Every financial account uses the workspace base currency (IDR by default). Other currencies are rejected with `CURRENCY_NOT_SUPPORTED` until G2b.
- Financial accounts: cash, bank, e-wallet, credit card.
- Opening balance, income, expense, transfer, refund, credit-card purchase and bill payment, reversal (and "edit" as reversal + repost), archive/unarchive.
- Categories (D-09 dimensions) and income sources.
- Balance and transaction-list read models (D-13 SQL views).

Out of G2a: FX, debt, adjustments, pockets/budgets/goals/recurring (Phase 3), household, import, attachments.

## 2. Chart of accounts (G2a)

Each personal workspace gets these **system ledger accounts** at provisioning (and by backfill for existing workspaces):

| System code | Class | Normal | Used by |
|---|---|---|---|
| `OPENING_BALANCE_EQUITY` | equity | credit | Opening balances |
| `INCOME` | income | credit | All income; category/source are dimensions |
| `EXPENSE` | expense | debit | All expenses and card purchases; refunds offset it |

Plus **one ledger account per financial account**, created with it: `asset` for cash/bank/e-wallet, `liability` for credit card.

Deliberately not created in G2a: FX gain/loss and rounding (G2b), interest/fee expense (G2c debt), household receivable/payable/contribution accounts (G5). They are added by their own migrations, which keeps every account here in use.

Rules (from Design Pack §4.3, made concrete):
- System accounts are identified by `system_code`, unique per workspace. Labels are localized in the UI, not stored.
- A single `INCOME` and a single `EXPENSE` control account is enough because categories carry the reporting detail (D-09). Splitting them later (e.g. a separate interest expense) is additive.
- Ledger accounts are never deleted once referenced; they follow their financial account's archive state.

## 3. Posting rules (G2a subset of the approved D-10 matrix)

Line amounts are positive `bigint` minor units; direction comes from the side. Every entry balances. The server builds the lines; clients never send debits or credits.

| Command | Debit | Credit |
|---|---|---|
| Opening balance, asset account | Account (asset) | `OPENING_BALANCE_EQUITY` |
| Opening balance, credit card (amount owed) | `OPENING_BALANCE_EQUITY` | Card (liability) |
| Opening balance, asset overdrawn (negative) | `OPENING_BALANCE_EQUITY` | Account (asset) |
| Opening balance, card in credit (negative owed) | Card (liability) | `OPENING_BALANCE_EQUITY` |
| Income into account | Account (asset) | `INCOME` |
| Expense from asset account | `EXPENSE` | Account (asset) |
| Expense on credit card (purchase) | `EXPENSE` | Card (liability) |
| Transfer asset → asset | Destination | Source |
| Credit-card bill payment (transfer asset → card) | Card (liability) | Source (asset) |
| Refund into asset account | Account (asset) | `EXPENSE` |
| Refund onto credit card | Card (liability) | `EXPENSE` |
| Reversal | Mirror of the original lines | Mirror of the original lines |

Worked example (IDR, exponent 0): salary Rp8.500.000 into BCA, then Rp150.000 groceries on a credit card, then a Rp50.000 partial refund to the card, then Rp100.000 card bill paid from BCA.

| # | Lines | BCA balance | Card owed | Expense total |
|---|---|---:|---:|---:|
| 1 | Dr BCA 8500000 / Cr INCOME 8500000 | 8,500,000 | 0 | 0 |
| 2 | Dr EXPENSE 150000 / Cr Card 150000 | 8,500,000 | 150,000 | 150,000 |
| 3 | Dr Card 50000 / Cr EXPENSE 50000 | 8,500,000 | 100,000 | 100,000 |
| 4 | Dr Card 100000 / Cr BCA 100000 | 8,400,000 | 0 | 100,000 |

Bill payment (#4) changes no expense total (ADR-007). The refund (#3) reduces expense and is not income (D-15).

Card balances may go below zero (overpayment, or a refund larger than the amount owed); the UI shows this as a credit balance. Asset balances may go negative per §10 Q3.

## 4. Tables and data dictionary (G2a)

Conventions follow Design Pack §3.3: UUID PK, `workspace_id NOT NULL`, same-workspace composite FKs `(workspace_id, id)`, money as `bigint` with a currency code, business dates as `date`, `timestamptz` for instants, RLS enabled in the creating migration.

### 4.1 `currencies` (reference, global)
`code char(3) PK`, `minor_units smallint NOT NULL CHECK 0..4`, `name text`. Seeded with IDR (0) and a short ISO list for later; read-only to `authenticated`.

### 4.2 `ledger_accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid NOT NULL → workspaces | unique `(workspace_id, id)` |
| account_class | text | `asset`/`liability`/`equity`/`income`/`expense` |
| system_code | text NULL | unique `(workspace_id, system_code)`; NULL for per-account ledgers |
| currency | char(3) → currencies | equals workspace base currency in G2a; unique `(workspace_id, id, currency)` for the composite FKs below |
| created_at | timestamptz | |

Clients: SELECT only (members). Writes only via provisioning and RPCs. Archive state lives only on `financial_accounts`, so there is no duplicate flag to drift.

Workspace base currency becomes immutable once the workspace has any ledger account (trigger on `workspaces`), so the single-currency rule cannot be broken later.

### 4.3 `financial_accounts`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | unique `(workspace_id, id)` |
| workspace_id | uuid NOT NULL | |
| ledger_account_id | uuid NOT NULL UNIQUE | composite FK to `ledger_accounts (workspace_id, id)` |
| kind | text | `cash`/`bank`/`ewallet`/`credit_card` |
| name | text | trimmed 1–80, unique per workspace among active accounts |
| currency | char(3) | composite FK `(workspace_id, ledger_account_id, currency)` to ledger_accounts guarantees it equals the ledger currency |
| archived_at | timestamptz NULL | archive only when balance = 0 (D-14) |
| created_at, updated_at | timestamptz | |

Clients: SELECT; UPDATE of `name` only, enforced by `REVOKE UPDATE` + `GRANT UPDATE (name)` (RLS cannot restrict columns). Create/archive via RPC.

### 4.4 `transaction_categories` and `income_sources`
`id`, `workspace_id`, `kind` (`income`/`expense`, categories only), `name` (trimmed 1–60, unique per workspace+kind among active rows), `archived_at`, timestamps. Non-financial: members insert, rename and archive directly under RLS, with column grants `INSERT (workspace_id, kind, name)` and `UPDATE (name, archived_at)` only, so `kind` and `workspace_id` never change after insert. The INSERT policy pins `workspace_id` to an active membership with a writer role. Archived rows stay referenced by history and are hidden from pickers. No snapshot: history shows the current name (§10 Q5).

### 4.5 `transactions` (business event header)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | unique `(workspace_id, id)` |
| workspace_id | uuid NOT NULL | |
| kind | text | `opening_balance`/`income`/`expense`/`transfer`/`refund`/`reversal` |
| occurred_on | date NOT NULL | business date in the workspace timezone; not in the future (§10 Q7) |
| amount | bigint NOT NULL CHECK > 0 | absolute value; for a negative opening balance the lines carry the direction |
| currency | char(3) | |
| category_id | uuid NULL | composite FK; required for income/expense, kind must match |
| income_source_id | uuid NULL | composite FK; income only, optional |
| account_id | uuid NULL | composite FK to financial_accounts; the account debited/credited by the user action |
| counter_account_id | uuid NULL | composite FK; transfer destination |
| refund_of_id | uuid NULL | composite FK to the original expense |
| reverses_id | uuid NULL UNIQUE | composite FK; one reversal per transaction |
| note | text NULL | ≤ 500 chars |
| created_by | uuid NOT NULL | `auth.uid()` |
| created_at | timestamptz | |

Every reference above is a composite `(workspace_id, ...)` FK, so even a SECURITY DEFINER bug cannot link rows across workspaces. Per-kind CHECK:

| kind | must be set | must be NULL |
|---|---|---|
| opening_balance | account_id | category, source, counter, refund_of, reverses |
| income | account_id, category_id | counter, refund_of, reverses |
| expense | account_id, category_id | source, counter, refund_of, reverses |
| transfer | account_id, counter_account_id (different from account_id) | category, source, refund_of, reverses |
| refund | account_id, refund_of_id | category, source, counter, reverses |
| reversal | reverses_id | everything else |

A reversal's amount equals the original's, and reversing a reversal is rejected (trigger, R-10). Refund and reversal rows report under the category of the transaction they point to, so category totals cancel correctly. Rows are immutable after insert (trigger rejects UPDATE/DELETE).

**Deviation from the Design Pack:** instead of a separate `transaction_reversals` table, the reversal link is `reverses_id UNIQUE` on the immutable header, and "is reversed" is derived. Same guarantees, one table fewer.

### 4.6 `journal_entries` and `journal_lines`
- `journal_entries`: `id`, `workspace_id`, `transaction_id` (composite FK), `posted_at`. G2a posts exactly one entry per transaction. The table stays separate so G2b FX and G5 paired entries need no reshaping.
- `journal_lines`: `id`, `workspace_id`, `journal_entry_id` (composite FK), `ledger_account_id` and `currency` (composite FK `(workspace_id, ledger_account_id, currency)`, so the line currency equals the account currency), `side` (`debit`/`credit`), `amount bigint CHECK > 0`, `base_amount bigint CHECK > 0` (equals `amount` in G2a).
- `DEFERRABLE INITIALLY DEFERRED` constraint triggers check at commit: on `journal_entries` insert, the entry has ≥2 lines and balances (this also catches an entry with no lines); on `journal_lines` insert, its entry balances; on `transactions` insert, exactly one entry exists in G2a (catches a transaction with no entry).
- Both tables are immutable (no UPDATE/DELETE, including for table owner paths other than migrations).

### 4.7 `financial_commands` (idempotency)
`workspace_id`, `operation`, `idempotency_key`, `request_fingerprint`, `actor`, `result jsonb`, `created_at`. PK `(workspace_id, operation, idempotency_key)` (R-03).

- The fingerprint is sha256 over the canonical payload plus the actor: amounts normalized (`"0100"` becomes `"100"`), note trimmed, UUIDs lower-case. Another member reusing a key gets `IDEMPOTENCY_CONFLICT`, never someone else's result.
- Under READ COMMITTED the claim is insert-first: a concurrent second caller blocks on the PK, then reads the committed row and replays (or proceeds if the first rolled back).
- A business error rolls back the claim too, so retrying the same key after fixing the input may succeed. This is intended: only successful effects are remembered.

### 4.8 `audit_logs`
`id`, `workspace_id`, `actor`, `action`, `entity`, `entity_id`, `details jsonb` (no amounts of other users, no free-text secrets), `created_at`. Append-only. Readable by the workspace owner only.

## 5. RPC contracts (G2a)

All in schema `public`, `SECURITY DEFINER`, `search_path = ''`. Postgres grants EXECUTE to PUBLIC by default and Supabase adds `anon`, so every function gets `REVOKE EXECUTE ... FROM PUBLIC, anon` then `GRANT EXECUTE ... TO authenticated`. Each one:
1. reads the actor from `auth.uid()`;
2. requires an active `owner`/`admin`/`editor` membership in `p_workspace_id`;
3. claims the idempotency key (`INSERT … ON CONFLICT DO NOTHING`, then compare the fingerprint: same → return the stored result with `replayed: true`; different → `IDEMPOTENCY_CONFLICT`);
4. validates, locks, writes the transaction, entry, lines, audit row and stored result in one database transaction.

Money crosses the wire as decimal integer strings (D-12) and is cast to `bigint` in SQL.

| Function | Payload (besides `p_workspace_id`, `p_idempotency_key`) | Notes |
|---|---|---|
| `create_financial_account` | `kind, name, currency, opening_balance text, opened_on date` | Creates ledger + financial account and, if the balance ≠ 0, the opening entry, atomically |
| `rename_financial_account` | not an RPC | Direct UPDATE of `name` under RLS |
| `archive_financial_account` / `unarchive_financial_account` | `account_id` | Locks the account; archive requires balance 0 (`RESOURCE_HAS_BALANCE`) |
| `post_income` | `account_id, category_id, income_source_id?, amount, occurred_on, note?` | Asset accounts only |
| `post_expense` | `account_id, category_id, amount, occurred_on, note?` | Asset → spend; credit card → purchase (Cr liability). Replaces a separate card-purchase RPC |
| `post_transfer` | `from_account_id, to_account_id, amount, occurred_on, note?` | Asset → asset, or asset → card (bill payment). Card → asset is rejected in G2a (cash advance needs a fee rule) |
| `post_refund` | `refund_of_id, account_id?, amount, occurred_on, note?` | Locks the original, which must be a posted, unreversed `expense` (refunding income, a refund, a reversal or a reversed expense: `VALIDATION_FAILED`). Rule: sum of its unreversed refunds + new amount ≤ original amount, else `REFUND_EXCEEDS_ORIGINAL` (D-15). `account_id` defaults to the original's account; another active same-currency account is allowed (§10 Q12) |
| `reverse_transaction` | `transaction_id, reason` | Locks the original (and, for a refund, its parent expense). One reversal only (`POSTED_ENTRY_IMMUTABLE` if already reversed). Reversing an expense with unreversed refunds: `HAS_DEPENDENT_REFUNDS`. Every account the original touched must be active, else `RESOURCE_ARCHIVED` (unarchive first), so an archived account never gains a hidden balance (D-14) |
| `edit_transaction` | `transaction_id` + the new payload of the same kind | Reverse + repost as one idempotent operation with one key; the response (and any replay) returns both `reversal_id` and the new `transaction_id`. Same guards as reversal, applied to the union of old and new accounts. Editing a refund checks the refund limit after the in-call reversal. An expense with unreversed refunds may change only category and note (amount and account stay), instead of failing with `HAS_DEPENDENT_REFUNDS` |

Response shape: `{ transaction_id, journal_entry_id, status: "posted", replayed, amounts as strings }`. Posting RPCs also reject archived categories, categories of the wrong kind, and archived accounts (`RESOURCE_ARCHIVED`). The reversal `reason` follows the audit redaction rule (trimmed, ≤ 200 chars, never shown to other members).

Errors (stable codes, subset of Design Pack §6.3 plus three new ones): `AUTH_REQUIRED`, `WORKSPACE_ACCESS_DENIED`, `ROLE_INSUFFICIENT`, `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `RESOURCE_ARCHIVED`, `POSTED_ENTRY_IMMUTABLE`, `REFUND_EXCEEDS_ORIGINAL`, `CROSS_WORKSPACE_REFERENCE`, `CONCURRENT_MODIFICATION`, **new:** `CURRENCY_NOT_SUPPORTED`, `RESOURCE_HAS_BALANCE`, `HAS_DEPENDENT_REFUNDS`. Unknown or foreign IDs return `VALIDATION_FAILED`, never revealing whether a row exists elsewhere.

## 6. Concurrency

- Isolation: READ COMMITTED with explicit row locks.
- One global lock order, always: **transaction rows first** (the original expense, then the refund being reversed or edited), **then `financial_accounts` rows**, each group in ascending UUID order. Every command that needs both follows it, so no two commands can wait on each other.
- Account locks (`FOR UPDATE`) also serialize archive against posting.
- Idempotency races are settled by the `financial_commands` primary key: the second caller waits for the first commit, then replays.
- Concurrent tests (two sessions) are required for: double refund, archive vs post, duplicate idempotency key.

## 7. RLS and grants (G2a, personal workspaces)

| Table | SELECT | INSERT/UPDATE/DELETE by clients |
|---|---|---|
| currencies | authenticated | none |
| ledger_accounts | active members | none |
| financial_accounts | active members | UPDATE `name` by owner/admin/editor |
| transaction_categories, income_sources | active members | INSERT, UPDATE (`name`, `archived_at`) by owner/admin/editor; no DELETE |
| transactions, journal_entries, journal_lines | active members | none (RPC only, D-11) |
| financial_commands | none | none |
| audit_logs | workspace owner | none |

`anon` gets nothing. Policies use the same inline `EXISTS (select 1 from workspace_members ...)` pattern as the identity migration, with `(select auth.uid())`, served by the existing `workspace_members (user_id, status)` index. There is no membership helper in `public`: a callable SECURITY DEFINER helper would let anyone probe other users' memberships.

## 8. Read models (D-13 SQL views, `security_invoker = true`)

- `account_balances`: per financial account, `balance = Σdebit − Σcredit` for assets and `Σcredit − Σdebit` for liabilities, from `journal_lines`. Archived accounts are flagged so the totals views can exclude them (D-14); reconciliation never excludes them.
- `transaction_feed`: transactions joined with category, source and account names, with `is_reversed` and `refunded_amount`, for the list screen.
- `period_totals(workspace, from, to)`: income and net expense (expenses minus refunds) per category. Reversed transactions and their reversals cancel out.

Reconciliation tests, per workspace, including archived accounts:
- Σdebit = Σcredit over all lines, and per entry.
- Σasset balances − Σliability balances = equity + income − expense, each as a normal-side positive. Worked example after step 4: 8,400,000 − 0 = 0 + 8,500,000 − 100,000.

## 9. Migration plan

| # | Migration | Contents | Safety |
|---|---|---|---|
| 1 | `…_currencies` | currencies table + seed, grants | additive, transaction-safe |
| 2 | `…_ledger_foundation` | ledger_accounts, transactions, journal_entries, journal_lines, financial_commands, audit_logs, immutability + balance triggers, RLS | additive |
| 3 | `…_accounts_and_classification` | financial_accounts, categories, income sources, RLS; extend `private.provision_user` to create system accounts (and default categories if Q4 = yes); backfill existing workspaces | additive, idempotent backfill |
| 4 | `…_posting_rpcs` | the §5 functions | additive (`create or replace` later only through new migrations) |
| 5 | `…_read_models` | §8 views | additive |

Each migration ships with pgTAP tests in the same PR: constraints, RLS per role, immutability, balance trigger, idempotency replay/conflict, refund limits, archive guard, cross-workspace rejection and reconciliation. After real data exists, fixes are forward-only (Design Pack §12.2).

## 10. Decisions needed from the product owner

| # | Question | Recommendation |
|---|---|---|
| Q1 | Approve the G2a split (single currency, no FX/debt/adjustment yet)? | **Yes.** Unblocks the core without guessing D-17/D-18/D-19 |
| Q2 | Card purchase = `post_expense` on a card account, and bill payment = `post_transfer` to a card (no separate card RPCs)? | **Yes.** Same accounting, two fewer commands to secure and test |
| Q3 | May an expense or transfer make a cash/bank/e-wallet balance negative? | **Allow and show it clearly.** Real banks allow overdrafts; D-16 already treats negative balances transparently. Blocking would stop users recording what actually happened |
| Q4 | Seed default categories for new workspaces? | **Yes, a short Indonesian set:** Makan & Minum, Transportasi, Belanja, Tagihan, Kesehatan, Hiburan, Pendidikan, Lainnya (expense); Gaji, Usaha, Hadiah, Lainnya (income). Users can rename or archive them |
| Q5 | When a category is renamed, does history show the new name? | **Yes, current name everywhere (no snapshot).** Simpler, and reports stay grouped. Archived categories still show in history |
| Q6 | "Edit transaction" in the UI = automatic reversal + repost? | **Yes.** Keeps posted entries immutable while the user simply edits |
| Q7 | Allow future-dated transactions? | **No.** Planned items belong to recurring drafts (Phase 3). Today is computed in the workspace timezone |
| Q8 | Correcting an opening balance before adjustments exist? | **Reverse and re-enter it** via `edit_transaction` |
| Q9 | Allow unarchiving an account? | **Yes.** The balance is zero at archive and nothing can post to an archived account (reversals and edits included), so unarchiving changes no total |
| Q10 | Who may post in a personal workspace? | **Owner only in practice** (the only member). The role check (owner/admin/editor) is written now so G5 needs no change |
| Q11 | Card → cash transfers (cash advance)? | **Defer to G2c**, because they usually carry fees and interest |
| Q12 | May a refund go to a different account than the original (e.g. card purchase refunded to BCA)? | **Yes, defaulting to the original account.** The other account must be active and in the same currency. Merchants sometimes refund this way |
| Q13 | May an opening balance be negative (overdrawn bank, card in credit)? | **Yes.** The sign picks the line direction (see §3) |

## 11. Verification to pass before G2a is called done

Ledger invariants from the roadmap exit criteria, scoped to G2a: balanced entries, immutability, idempotent retries, workspace isolation (two users), transfer and card-payment neutrality on expense totals, refund limits under concurrency, archive guard, no hard delete with history, and balances reconciling to journal lines. Plus frontend: money as strings → `bigint`, no float arithmetic, all copy in `id.json`.
