# G2a UI plan v1 (DRAFT, awaiting approval)

Screens for accounts and transactions on top of the merged G2a ledger (PR #10, #11). No migration needed.

## Shared rules
- Money: digit string on the wire, `BigInt` in code, never `Number()`/`parseInt()` in `features/finance`.
- Amount input: `parseAmountInput` accepts "Rp 1.500.000" → "1500000"; rejects commas, letters, >15 digits; `-` only for opening balance. `type="text" inputMode="numeric"`, reformat on blur.
- Idempotency key: one UUID per form; kept on network error (retry = same key), new key after success or server rejection. Forms call `settle()` when the user changes values after a network error, so a changed payload never reuses the old key.
- Errors: map `message` code (P0001) → `finance.errors.*`; never show `details`. Client checks future date, same from/to, card rules, name 1–80, note ≤500.
- Workspace from `user_settings.default_workspace_id`.
- Query keys `accounts`, `categories`, `incomeSources`, `feed`, `periodTotals` per workspace; postings invalidate accounts+feed+totals on success. No optimistic updates.
- All text in `id.json`; errors in `role="status"`; labels and focus handled.

## PRs, in order
1. **Foundation** (no UI): parseAmountInput, error map, keys, useWorkspace, api wrappers, useIdempotencyKey + unit tests.
2. **Accounts screen**: list with balance (card = owed), create form, archive (blocked while balance ≠ 0) / unarchive.
3. **Record transaction**: one form for income / expense / transfer with kind-specific fields.
4. **Transaction list + month totals**: month picker, feed with reversed/refund badges, income / expense / net card.
5. **Refund, reverse, edit**: row actions; refund defaults to remaining amount and original account; edit sends only changes.
6. **Polish**: optional dashboard summary, full manual check (offline retry → exactly one row, keyboard-only pass).

## Known limits (accepted for G2a)
- Edit cannot remove an income source once set (would need a migration).
- Opening-balance amount cannot be edited in the UI: `transaction_feed.amount` is unsigned, so a negative opening balance could flip sign. Fix later by adding a signed amount to the view (migration). Date and note stay editable.
- Feed shows max 100 rows per month, no pagination; indexes on `reverses_id`/`refund_of_id` may be needed later (migration, deferred).
