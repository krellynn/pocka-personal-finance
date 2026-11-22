# POCKA — Household Privacy & Sharing

Status labels: **Approved** · **Proposed** · **Pending product-owner decision**.

> **The privacy rules in §2 are non-negotiable (Approved).** No feature, convenience, or bug fix may weaken them. If a feature appears to require it, stop and ask the product owner.
>
> Governing decisions: [ADR-013](decisions/ADR-013-household-privacy-invariants.md) (privacy invariants) · [ADR-003](decisions/ADR-003-shared-summary-policy.md) (shared summary empty by default) · [ADR-005](decisions/ADR-005-household-contribution-accounting.md) (contribution accounting) · [ADR-009](decisions/ADR-009-household-membership-exit.md) (membership exit) · [ADR-010](decisions/ADR-010-expense-split-methods.md) (split methods).

---

## 1. Principles (Approved)

1. **Ownership, membership, visibility, and contribution are separate concepts.** Holding one never implies another.
2. A record's visibility is decided by its **explicit scope**, not by who its owner is connected to.
3. Being a household **owner or admin grants no access** to any member's private finances.
4. Personal → household information flows **only by the member's explicit action**, through whitelisted projections.
5. **Revocation is immediate.**
6. Enforcement happens in **PostgreSQL RLS and server-side functions**. The UI hides things for usability but is never the security boundary.
7. **No inference:** household views must not allow a member's private values to be reconstructed.

## 2. What Is Private and What Is Shared (Approved)

| Data | Scope |
|---|---|
| Personal salary and income details (amounts, sources, employers) | **Private** |
| Personal account balances | **Private** |
| Personal transactions | **Private** |
| Personal assets and liabilities | **Private** |
| Personal net worth | **Private** |
| Household contributions (commitments and payments) | **Shared** |
| Household expenses, **including details** (merchant, amount, category, date, payer, splits, notes, attachments) | **Shared** |
| Records the member explicitly shares | **Shared** (whitelisted fields only) |
| Summary information | **Shared summary**: whitelist is **EMPTY by default** (Approved, ADR-003). No automatic sharing of salary, income totals, personal balances, net worth, or personal transaction aggregates. Any future field needs explicit product-owner approval |

## 3. Visibility Scopes

| Scope | Who can read | How it is created |
|---|---|---|
| `private` | Record owner only | Default for every personal-workspace record |
| `shared` | All active members of the record's (household) workspace, or the members listed in `shared_item_members` | Default for household-workspace records; or a member shares a projection |
| `shared_summary` | Active household members | Only through a `shared_items` projection containing approved summary fields. **The approved list is empty in V1** (ADR-003), so no V1 feature produces `shared_summary` data. The source record stays private. |

**Strict privacy invariant (ADR-003 + ADR-013):** with an empty `shared_summary` whitelist, *no personal financial value of any member reaches the household* except through (a) household-workspace records the member creates, such as household expenses, contributions, and advances, and (b) `shared` projections the member explicitly creates with whitelisted fields.

A private record **never** becomes visible because its owner joins a household, changes role, or contributes.

## 4. Membership & Roles

Membership: `workspace_id`, `user_id`, `role`, `status` (`invited`|`active`|`left`|`removed`), `joined_at`. Only `active` members have any access.

Roles (**Proposed**):

| Action (household workspace) | owner | admin | editor | viewer |
|---|:-:|:-:|:-:|:-:|
| View shared household records | ✓ | ✓ | ✓ | ✓ |
| Record shared expense / contribution payment | ✓ | ✓ | ✓ | – |
| Edit shared budgets, pockets, goals | ✓ | ✓ | ✓ | – |
| Reverse household transactions | ✓ | ✓ | own only (Proposed) | – |
| Invite / remove members, change roles | ✓ | ✓ (not owners) | – | – |
| Change workspace settings / base currency | ✓ | ✓ | – | – |
| Delete or close the household | ✓ | – | – | – |
| **View any member's private personal data** | **✗** | **✗** | **✗** | **✗** |

A household must always have at least one owner.

### Leaving a household (Approved: ADR-009)

When a member leaves or is removed:

1. Household access is **revoked immediately**. RLS admits only `active` members.
2. Status becomes non-active: `left` (voluntary) or `removed` (by an admin).
3. Household transaction history, contribution records, outstanding receivables/payables, and settlement history are **all preserved**. **Nothing is deleted.**
4. **No private personal records are exposed** during or after the exit.
5. **Obligations survive the exit.** Outstanding settlements remain available to authorised household administrators and the relevant parties. The departed member still sees their side (e.g. *Receivable from Household*) in their personal workspace.

How a departed member participates in settling open obligations without regaining household access, and ownership transfer when the last owner leaves, are implementation details requiring design review.

## 5. Sharing Projections

When a personal record needs to inform the household (e.g. "I paid this household bill from my own card"):

1. The member chooses to share. Nothing is shared automatically.
2. The system creates a `shared_items` row in the household workspace containing **only whitelisted fields**, copied as a snapshot (Proposed) or exposed via a restricted view.
3. The source personal record remains `private` and **is never exposed wholesale**. No foreign key from household rows to personal rows may be followed by a household member's query.
4. Whitelists are defined per `source_type` in code and reviewed. Example (Proposed):

| Source type | Allowed fields | Never shared |
|---|---|---|
| Personal expense paid for household | date, amount, currency, description, category | source account, account balance, other transactions |
| *(none in V1)*: any summary-type field, e.g. "contribution capacity" | **not allowed**; `shared_summary` whitelist is empty (ADR-003) and needs product-owner approval to change | salary, income source, employer, balances, net worth |

5. **Revocation:** setting `shared_items.status = revoked` removes household read access **immediately**. RLS checks `status = active` on every read, and there is no cached copy outside the database. A `shared_item_events` entry is written.
   *Exception (Proposed):* financial facts already **posted in the household ledger** (e.g. a household expense and its payable) are household records, not projections. They are not erased by revocation, because erasing them would break the household's books. The UI must make this clear before posting.

## 6. Contribution Model (Approved)

Three distinct concepts. They must never be conflated.

| Type | Meaning | Household ledger effect |
|---|---|---|
| **Commitment** | A promise to contribute X for a period | **None.** Stored in `shared_contributions`; never increases household cash |
| **Actual transfer** | Money moved into a household-owned account | Dr household cash/bank · Cr member contribution (equity, Proposed) |
| **Direct household payment** | Member pays a household expense from personal funds | No household cash movement; see funding intent below |

**Funding intent** (Approved, ADR-005) has exactly two values, which stay distinct throughout the system: `contribution` and `reimbursable_advance`.

#### A. `contribution`

| Workspace | Treatment |
|---|---|
| Personal | Personal **expense** in the *Household Contribution* category. Reduces personal cash/bank. **No receivable.** |
| Household | Household **funding**. An actual transfer increases the household-owned account. A direct payment funds a household expense. A **commitment does not** increase household cash. |

- Personal: Dr Household Contribution (expense) · Cr Personal Bank
- Household, actual transfer: Dr Household Bank · Cr Member contribution (funding)
- Household, direct payment: Dr Household Expense · Cr Member contribution (funding)

#### B. `reimbursable_advance`

| Workspace | Treatment |
|---|---|
| Personal | **Receivable from Household**. **Not an expense** at payment. Reduces personal cash/bank. |
| Household | Recognise the **household expense** and a **payable to the member**. |

- Personal: Dr Receivable from Household · Cr Personal Bank
- Household: Dr Household Expense · Cr Payable to Member

Partial payments (Approved): a commitment may be satisfied by several `contribution_payments`. Commitment status becomes `partially_paid` and then `paid`. Commitment amounts and received amounts are always reported **separately**. A promise is never treated as received money.

A direct payment must **not** be counted as a household cash transfer, because the money never entered a household account.

#### Cross-workspace accounting and privacy

- One real-world event can produce **two journal entries in two workspaces**, each balanced on its own.
- They are linked privately. Household members see only household-side facts, and the personal entry stays `private`.
- **Reconciliation:** per member and household, *Receivable from Household* (personal) should equal *Payable to Member* (household) for the same advances. Only the member (who can see both sides) or a server-side job may compare them. Results never surface personal data to the household.
- The household's books are correct even if the member never records the personal side.
- The mechanism for creating the paired personal entry requires design review.

## 7. Reimbursable Advances & Settlement Accounting (Approved)

**Member pays a household expense from personal funds (advance):**

| | Debit | Credit |
|---|---|---|
| Expense occurs | Household expense | Payable to member |

**Household reimburses the member (full or partial):**

| | Debit | Credit |
|---|---|---|
| Household workspace | Payable to member | Household cash/bank |
| Member's personal workspace | Personal bank | Receivable from Household |

Partial reimbursements reduce the payable and receivable by the amount paid. The rest stays outstanding.

Rules:
- The expense is recognised **once**, when it occurs. **Reimbursement must not create a second expense.**
- **Settlement never creates income or expense.** It moves only assets and payables/receivables.
- Settlement statuses: `proposed` → `pending` → `completed`, or `cancelled`. Only `completed` posts a journal entry. A cancelled settlement posts nothing, or is reversed if it was already posted.
- `settlement_allocations` record which payables, receivables, or splits a settlement clears. A settlement cannot over-settle an obligation.

**Expense splits (Approved: ADR-010):** `shared_expense_splits` assign each member's share of a household expense, and determine member-to-member obligations when one member has paid more than their share. V1 methods:

| Method | Input | Validation |
|---|---|---|
| Equal | included participants | weight 1 each |
| Fixed amount | amount per participant | Σ amounts = total exactly (no auto-adjust) |
| Percentage | % per participant | Σ % = exactly 100 |
| Weighted shares | positive weight per participant | weights > 0 |

- Participants are explicitly **included or excluded**. Excluded participants get 0.
- Σ shares (minor units) **= expense total** always. No remainder is lost.
- Equal, percentage, and weighted shares convert deterministically: floor each exact share, then distribute the remaining minor units by **largest fractional remainder**, with **ties broken by participant order** in the split.
- Example: Rp100.000 equal among A, B, C → 33.334 / 33.333 / 33.333.

## 8. Household Reporting (Approved)

May include: household-owned cash/bank balances; contributions received; commitments (**clearly separated** from received funds); shared expenses and splits; shared budget vs. actual; settlements and reimbursements; household goals.

Must **exclude**: personal salary details, personal account balances, private transactions, private assets and liabilities, and combined personal net worth.

**Anti-inference rules (Proposed):**
- Never show "household income" derived from members' salaries.
- Never compute "member's remaining money" or anything that combines household and private data.
- Aggregates are computed **only** from household-workspace rows and active projections.
- Notifications about household events contain household data only.

## 9. Privacy Acceptance Tests

Each test runs against the database with RLS active, authenticated as the given user (not the service role). Setup: users **A** (household owner), **B** (household member, editor), **C** (non-member). Household **H**. Personal workspaces **PA**, **PB**.

| # | Scenario | Expected |
|---|---|---|
| P1 | A queries `transactions`, `financial_accounts`, `income_sources`, balances of **PB** | 0 rows / denied |
| P2 | A (owner/admin of H) queries any table filtered by B's `user_id` | Only B's **household** rows, never PB rows |
| P3 | C queries any H data | 0 rows |
| P4 | B joins H → A queries B's personal salary or income source | 0 rows |
| P5 | B shares a personal expense as a projection → A reads it | Only whitelisted fields; source account and balance absent |
| P6 | A tries to read the projection's `source_id` record directly | Denied |
| P7 | B revokes the projection → A re-queries immediately | 0 rows |
| P8 | Household report run by A | Contains no salary, personal balance, private transaction, or personal net worth |
| P9 | A calls an RPC with B's personal `account_id` in a household transaction | Rejected (workspace mismatch) |
| P10 | B is removed from H → B queries H | 0 rows |
| P11 | Commitment of Rp1.000.000 by B | Household cash balance unchanged |
| P12 | B direct-pays Rp300.000 as reimbursable advance, then household reimburses | Household expense total = Rp300.000 (not 600.000); payable to B = 0; household cash −300.000 |
| P13 | Settlement completed | No income or expense lines in its journal entry |
| P14 | Viewer role attempts to post a household expense | Denied |
| P15 | Admin attempts to change B's personal-workspace data via RPC | Denied |
| P16 | Notification payloads delivered to A | Contain no B private data |
| P17 | Direct-payment with intent `contribution` | Household cash unchanged; expense recognised once; contribution credited to B; B's personal entry is an expense with **no** receivable |
| P18 | Any attempt to create a `shared_summary` projection with a field (e.g. income total, balance, net worth) | Rejected; whitelist is empty (ADR-003) |
| P19 | B leaves H while A owes B Rp200.000 (payable) | B loses H access immediately; payable, history, and settlements preserved; settlement still recordable |
| P20 | B's advance of Rp300.000, partially reimbursed Rp100.000 | Household payable to B = 200.000; B's personal receivable = 200.000; no expense from reimbursement |

All P-tests must pass in CI before any household feature is released.


---

## 10. Paired financial events and departed-member access — design clarification (2026-11-21)

### 10.1 Paired personal/household posting lifecycle

Direct payment from personal funds creates distinct personal and household ledger facts. They are separately balanced and authorized, correlated only by an opaque server-generated pair ID. Household queries never traverse to personal transaction IDs, account IDs, journal lines, descriptions or balances. Persist pair intent and request fingerprint; track per-side status and idempotency; mark complete only after both sides post. If one side fails, retain pending/partial-failure state and retry only the missing side. If cancellation follows a successful side, use audited reversal/compensation, never delete posted facts. Reconcile stale pairs. A single DB transaction is acceptable only if both authorization checks and writes are proven atomic without weakening RLS; otherwise use a durable recoverable workflow. See design pack §17.1.

### 10.2 Contribution-intent accounting pair

For a member paying a household expense directly from personal funds with contribution intent: personal Dr Household Contribution expense / Cr Personal asset; household Dr Household expense / Cr Member Contribution Funding (classification pending CoA approval). No household cash account is involved. For reimbursable advance, personal Dr Receivable from Household / Cr Personal asset; household Dr Household expense / Cr Payable to Member. Reimbursement clears the balances without a second expense. See design pack §17.5.

### 10.3 Departed-member obligation-only endpoint

A left/removed member loses ordinary household RLS access immediately. The member may use only an obligation-scoped view/RPC bound internally to auth.uid() and a specific obligation. It returns only their own amount, currency, status and minimum settlement details; it cannot enumerate household data or restore membership. Settlement revalidates under lock and is audited. SECURITY DEFINER requires fixed search_path, restricted execute grants and explicit identity/obligation checks. Ordinary table SELECT remains denied.

### 10.4 Required tests

Before G5 test either side failing, duplicate retry, same key/different payload, stale pair reconciliation, cancellation after one side posted, member exit during pending pair, departed member denied household lists but allowed only their own obligation, unrelated member denied, and no household response containing personal identifiers or private values.
