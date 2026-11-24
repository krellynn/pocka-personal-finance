# G3a — Pockets & Budgets (v1, APPROVED 2026-11-25)

Builds on G2a (approved 2026-11-25), D-09, D-11–D-16, ADR-002, ADR-008. Where more specific than the Design Pack or DATABASE_SPECIFICATION, this is a proposal, not an override; deviations are marked.

## 1. Scope
**In:** personal workspace, IDR only (others → `CURRENCY_NOT_SUPPORTED`). Pockets: create, rename, archive/unarchive, allocate, deallocate, move, history, "Belum dialokasikan" with visible shortfall. Budgets: monthly planned amount per expense category, budget vs actual, audited plan changes.
**Out:** goals and goal-linked targets, recurring, debt, "spend from pocket" (Q6), FX pockets (D-18/19), household (G5), non-monthly periods, dashboard widgets (Phase 4).

## 2. Tables
- **`pockets`**: id, workspace_id, name (1–60, unique among active), currency (= base), target_amount bigint NULL >0 (Q4, display only), archived_at, timestamps. No account link (ADR-002). Clients: SELECT + UPDATE(name).
- **`pocket_movements`** (immutable, `forbid_change`): id, workspace_id, from_pocket_id NULL (= Unallocated), to_pocket_id NULL (= Unallocated), amount >0, currency, note ≤200, created_by, created_at. CHECK one side set and sides differ. Allocate = NULL→P, deallocate = P→NULL, move = P→Q. *Deviation:* one row per command instead of signed paired rows with `transfer_group_id` (DATABASE_SPECIFICATION §3.5): a move cannot lose half its pair.
- **`budgets`**: PK (workspace_id, period_month, category_id); period_month = first of month; category must be an active expense category; planned_amount >0; currency; timestamps. History in `audit_logs`. *Deviation:* no `budgets`/`budget_categories`/`budget_adjustments` header tables (Design Pack); a header can be added later if G5 needs it. Clients: SELECT only.

## 3. RPCs (G2a pattern: SECURITY DEFINER, `search_path=''`, revoke PUBLIC/anon, `require_writer`, `parse_amount`, `fail`, `audit`)
| Function | Rules |
|---|---|
| `create_pocket(ws, key, name, target?)` | idempotent; name unique among active |
| `set_pocket_archived(ws, pocket, bool)` | archive only at balance 0 (`RESOURCE_HAS_BALANCE`); unarchive re-checks name |
| `allocate_to_pocket(ws, key, pocket, amount, note?)` | accept only if eligible − (allocated + amount) ≥ 0, else `ALLOCATION_EXCEEDS_ELIGIBLE` |
| `deallocate_from_pocket(ws, key, pocket, amount, note?)` | always allowed (also during shortfall); amount ≤ pocket balance, else `POCKET_INSUFFICIENT` |
| `move_between_pockets(ws, key, from, to, amount, note?)` | total unchanged, allowed during shortfall; amount ≤ source balance |
| `set_budget(ws, month, category, amount)` | upsert absolute value; `"0"` deletes; audited old/new |
| `copy_budgets(ws, from_month, to_month)` | inserts only missing categories, skips archived (Q8) |

Pocket balances never go below zero; a negative "Belum dialokasikan" is the only form of shortfall.

## 4. Read models (views, `security_invoker`, money as text)
- `pocket_balances`: Σ in − Σ out per pocket.
- `pocket_summary`: eligible = Σ active cash/bank/e-wallet balances from `account_balances` (negatives reduce it, cards excluded — D-16); allocated; unallocated; is_shortfall. `private.eligible_funds(ws)` uses the same formula; a test checks they agree.
- `budget_vs_actual(ws, month)`: budgets full-joined with expense rows of `period_totals`; planned, actual, remaining, is_over; spending without a budget shows as "Tanpa anggaran" so totals reconcile.

## 5. Concurrency
- One per-workspace advisory lock (`pg_advisory_xact_lock`) taken first by every pocket command; balances re-read after it. Never `FOR UPDATE` on `workspaces` (would block every posting). Verified: no existing migration locks `workspaces`.
- Postings do not take the pocket lock: spending may create a shortfall (D-16). No deadlock with the G2a lock order.
- Two-session tests: two allocations exceeding eligible (one wins), allocate vs expense, two moves draining one pocket, archive vs allocate, duplicate key.

## 6. RLS
Members read pockets, movements, budgets; client writes only `pockets.name` (owner/admin/editor). Inline EXISTS policies as in G2a; anon nothing.

## 7. Delivery
1. Migration `pockets` + pgTAP · 2. Pockets page (read) · 3. Create/rename/archive · 4. Allocate/deallocate/move · 5. Pocket history · 6. Migration `budgets` + pgTAP · 7. Budget page (month, plan vs actual) · 8. Edit plan + "Salin dari bulan lalu".

## 8. Open questions (recommendation in bold)
| # | Question | Recommendation |
|---|---|---|
| Q1 | Budget period | **Calendar month only** (workspace timezone) |
| Q2 | Budgets on income categories | **No, expense only** |
| Q3 | Archive a pocket with money in it | **Require balance 0**, UI offers "Kembalikan ke Belum dialokasikan" first |
| Q4 | Pocket target amount | **Optional, display only** (progress bar) |
| Q5 | Backdated pocket movements | **No**, effective time = when recorded |
| Q6 | Expense automatically reduces a pocket | **Not in G3a**; user deallocates manually |
| Q7 | Refund in a later month | **Reduces the refund's own month** (current period_totals behaviour) |
| Q8 | Budget rollover | **No rollover**; offer "copy last month's plan" |
| Q9 | Edit past months' budgets | **Allow**, audited |
| Q10 | Account archived | **No effect on pockets** (archive only at balance 0) |
| Q11 | Card spending reduces "Belum dialokasikan"? | **No** (D-16); explained in help text, it drops when the bill is paid from bank/cash |
| Q12 | Concurrent budget edits | **Last writer wins**, audit log as record |
| Q13 | Budget for an archived category | **No new/updated rows**; past rows still shown |

## 9. Spec notes
- Table shapes deviate from DATABASE_SPECIFICATION §3.5/§3.6 (see §2) — needs explicit approval.
- Invariant 18 ("Σ allocations ≤ eligible funds") should read "at allocation time"; spending may break it later (D-16).
- Performance: eligible funds are re-summed per allocation — fine at personal scale; cache only if profiling shows a need.
