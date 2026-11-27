# G3b — Goals (v1, design approved 2026-11-28; migration awaiting approval)

Builds on G3a (pockets, budgets). Same patterns: RPC-only writes, `SECURITY DEFINER`, `search_path=''`, `require_writer`, `parse_amount`, `fail`, `audit`, money as text, views `security_invoker`.
`supabase/migrations/20261128000000_goals.sql` (untracked, not authored here) is reference only: it fails on this schema (`private.update_timestamp`, `pockets.is_archived`, subquery in CHECK) and breaks the RPC-only/audit/`require_writer` rules. It is replaced, not applied.

## 1. Scope
**In:** personal workspace, IDR only (others → `CURRENCY_NOT_SUPPORTED`). A goal: name, target amount, optional target date, optional note, optional link to one pocket. Create, rename/edit, archive/unarchive, progress, list.
**Out:** milestones (nobody asked), multi-currency (G2b), recurring contributions, auto-allocation, household sharing (G5), dashboard widgets.

## 2. Tables
- **`goals`**: id, workspace_id, name (1–60, trimmed, unique among active, case-insensitive), target_amount bigint >0, currency (= base, FK currencies), target_date date NULL, notes text NULL ≤500, pocket_id uuid NULL, archived_at, timestamps (`private.set_updated_at`).
  - Pocket link: `foreign key (workspace_id, pocket_id) references pockets (workspace_id, id)` (same workspace by construction, no CHECK subquery). One active goal per pocket (partial unique index on `pocket_id where archived_at is null`).
  - Clients: SELECT only. All writes via RPC; changes audited (`create_goal`, `update_goal`, `archive_goal`).

## 3. RPCs
| Function | Rules |
|---|---|
| `create_goal(ws, key, name, target, date?, note?, pocket?)` | idempotent via `claim_command`; pocket must be active, in workspace, not linked to another active goal |
| `update_goal(ws, goal, name, target, date?, note?, pocket?)` | absolute state, no key; audited old/new; archived goals not editable |
| `set_goal_archived(ws, goal, bool)` | unarchive re-checks name and pocket link |

Errors reuse existing codes; new: `GOAL_NOT_FOUND`, `POCKET_ALREADY_LINKED`.

## 4. Read model
`goal_progress` (security_invoker): goal fields + `saved` (= pocket balance, 0 if unlinked), `remaining` (= greatest(target − saved, 0)), `percent` (integer 0–100, computed in numeric, capped), `is_reached`. Money as text. Unlinked goals show 0 saved and a hint to link a pocket (progress is virtual, D-16).

## 5. UI (all text in id.json)
New "Target" page: list with progress bar (role=progressbar), create/edit form, archive. Reuses `Field`, `SelectField`, `parseAmountInput`, `invalidateLedger` (+ goals key).

## 6. Delivery
1 PR: migration + pgTAP (access, validation, link rules, audit, view math at max digits) + api/keys/errors + page + tests + docs. Reviewers: architecture-reviewer before, code-reviewer after. Migration needs explicit approval at that point.

## 7. Open questions (recommendation in bold)
- Q1: Progress for unlinked goals? **0 and show "hubungkan pocket"** / manual progress entry.
- Q2: Several goals per pocket? **No, one active goal per pocket** / allow.
- Q3: Target below current pocket balance? **Allowed, shows reached** / block.
- Q4: Archived goals keep the pocket link? **Link released on archive** / keep.

## 8. Review amendments (architecture-reviewer, 2026-11-28; Q1–Q4 approved as recommended)
1. `set_pocket_archived` is redefined: fails `POCKET_LINKED_TO_GOAL` while an active goal links the pocket (blocking, simplest). Listed in the PR.
2. Every RPC that links a pocket (create, update) takes `private.lock_pockets(ws)` before `check_pocket`; order: advisory lock, then goal row `FOR UPDATE`.
3. Both partial unique indexes (active name lower(), active pocket_id) are pre-checked under the lock; `unique_violation` is a backstop mapped by constraint name to `VALIDATION_FAILED 'name taken'` / `POCKET_ALREADY_LINKED`.
4. `goal_progress` joins `public.pocket_balances` (no call to private helpers).
5. `percent = least(100, floor(saved::numeric*100/target))::int`; `is_reached = saved >= target`; pgTAP at 999999999999999 for both.
6. Q4 resolved: archive clears `pocket_id` and stores the released id in the audit details; unarchive returns unlinked and re-checks only the name.
7. `create_goal` fingerprint covers all fields; `update_goal` is a no-op without an audit row when nothing changed, otherwise audits changed fields old/new (money as text).
8. Also: `forbid_change` delete trigger, `set_updated_at` trigger, index on `workspace_id`, link index `where pocket_id is not null and archived_at is null`, `name = btrim(name)` CHECK, `target_date` bounded (>= today at write, <= 2100-12-31), reuse `private.clean_note`, RLS member-read policy, `revoke all` then `grant select` only on table and view, revokes on private helpers.
