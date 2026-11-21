# POCKA V1 — Quality and Test Strategy

**Status:** Proposed quality plan; tests and CI do not yet exist.  
**Principle:** No speed target overrides financial correctness, privacy or data integrity.

## 1. Test layers

| Layer | Proposed tooling | Scope | Gate |
|---|---|---|---|
| Static checks | ESLint, Prettier, TypeScript strict | Style, type safety, unsafe patterns | Every PR |
| Unit | Vitest | Money/date/format/split/schema helpers | Every PR |
| Database | pgTAP or documented SQL harness via Supabase CLI | Constraints, posting rules, RLS | Every DB PR |
| Integration | Vitest + isolated local Supabase | RPCs, idempotency, concurrency, ledger | Every finance PR |
| E2E | Playwright | Critical user journeys | Every milestone and release |
| Accessibility | axe-based checks + manual keyboard review | WCAG AA and interaction | Every major screen |
| Security | Dependency scan, secret scan, RLS review | Secrets, auth, authorization | Every PR/release |
| Performance | Browser profiling and query analysis | Load time, list/report queries | Pre-release |

Tool versions and exact CI commands are implementation details to verify at Phase 0B.

## 2. Financial invariant catalogue

The following tests are mandatory wherever relevant:

### Ledger
- Debit total equals credit total for every posted journal.
- Posted entries/lines cannot be updated or deleted.
- Reversal is balanced, linked and immutable.
- Invalid reversal/reversal-of-reversal is rejected according to approved policy.
- Idempotency key retry does not create duplicate postings.
- Concurrent postings preserve correct balances.
- Cross-workspace references are rejected except approved paired workflows.

### Money precision
- IDR (0 decimal), USD (2 decimal), JPY (0 decimal) parsing/formatting.
- Unsupported fractional precision rejected.
- Half-even rounding at exact midpoint and adjacent values.
- Very large values never pass through unsafe JS Number.
- Wire conversion preserves exact integer minor units.

### Classification and cash flow
- Transfer does not affect income/expense.
- Pocket allocation and goal contribution do not affect ledger or net worth.
- Loan proceeds are not income.
- Principal repayment is not expense; interest/fee are.
- Credit-card bill payment is not a second expense.
- Refund offsets original expense and cannot exceed refundable amount.

### Planning
- Budget actuals include only eligible posted expenses and subtract refunds.
- Pocket allocations do not exceed eligible funds.
- Unallocated is calculated as eligible funds less allocated funds.
- Goal progress does not double-count pocket assets.
- Recurring drafts never affect balances/reports.
- Recurring occurrence retry does not create duplicate draft.

### FX
- Posted snapshot is immutable after rate changes.
- Conversion uses approved rounding once.
- Realized gain/loss only on actual conversion/settlement.
- No unrealized revaluation entries in V1.

### Household
- Commitment does not increase cash.
- Actual transfer increases household cash only on actual receipt.
- Direct payment is not represented as a household cash transfer.
- Contribution and reimbursable advance have distinct accounting.
- Reimbursement clears payable/receivable without duplicate expense.
- Split parts sum exactly to total using deterministic largest remainder.
- Member exit revokes access but preserves obligations/history.

## 3. Privacy and RLS test matrix

All acceptance tests P1–P20 in `HOUSEHOLD_PRIVACY.md` are mandatory. Additionally test:
- Anonymous access denied.
- User A cannot read/update User B profile/settings.
- User A cannot access User B personal workspace by guessed UUID.
- Household member cannot read another member's personal salary, account balances, transactions, assets or liabilities.
- Household owner/admin does not bypass private-record boundary.
- Shared data only exposes approved fields.
- Revocation/leave/remove immediately blocks subsequent requests.
- Role changes take effect at database boundary.
- Invitation tokens are hashed, expire and cannot be replayed.
- Service-role secret is absent from browser bundle, Git and logs.

Run RLS tests with at least two distinct authenticated users and separate workspaces. Testing only as database owner/service role is insufficient.

## 4. E2E release journeys

Required journeys are listed in `FUNCTIONAL_SPECIFICATION_V1.md` §17. Each E2E must assert not only visible UI but also resulting ledger/report invariants where possible.

## 5. Test data policy

- Use isolated local/test Supabase projects and synthetic fixtures.
- Never insert fake/demo financial activity into a real user's workspace.
- Never run tests against production.
- Test fixtures must be deterministic and resettable.
- Do not store real banking credentials or sensitive payment data in fixtures.
- Household fixtures must include multiple users and private/shared records.

## 6. CI quality gates

Proposed pull-request pipeline:
1. Install from lockfile.
2. Lint.
3. Format check.
4. Typecheck.
5. Unit tests.
6. Build.
7. Database migration validation and pgTAP/RLS tests where database changes exist.
8. Integration tests where finance RPC changes exist.
9. E2E smoke tests for critical paths at milestone gates.
10. Dependency and secret scan.

A failed required gate blocks merge. Exceptions require explicit product-owner approval and documented scope/time limit; no security or ledger invariant may be waived for release.

## 7. Risk-based test requirements

| Change type | Required evidence |
|---|---|
| UI-only copy/layout | Unit/static checks, accessibility smoke, relevant E2E |
| Money/date helper | Unit tests including edge cases and timezone boundaries |
| Schema/migration | Migration validation, constraints, pgTAP, RLS |
| Posting RPC/ledger | Integration, invariants, idempotency, concurrency, reversal |
| Household/privacy | Full impacted P1–P20 tests, two-user RLS tests, E2E |
| Import | Parser tests, duplicate cases, partial failure, posting integration |
| Reports | Reconciliation against known ledger fixtures |
| Deployment config | Preview smoke, nested-route refresh, secrets/bundle scan, rollback verification |

## 8. Release gates

### Internal alpha
- Auth and personal workspace work.
- Core ledger invariants pass.
- No known critical/high security issue.
- No fake balances or hard-coded financial fallbacks.

### Personal V1 candidate
- Core personal modules and reports reconcile to ledger.
- Money/date test suite passes.
- Backup/recovery and error monitoring plan exists.
- E2E critical personal flows pass.

### Household V1 candidate
- All P1–P20 pass.
- Cross-user private-data tests pass.
- Membership exit/revocation and settlements pass.

### Production V1
- Full CI green.
- Security and dependency review completed.
- RLS and secret scan completed.
- Backup/restore process tested.
- Cloudflare preview and production separation verified.
- Supabase region and plan reviewed.
- Domain/DNS, monitoring, rollback and incident ownership documented.
- Product owner explicitly approves production deployment.

## 9. Defect severity

- **P0 Critical:** financial corruption, cross-user private-data leak, secret exposure, unauthorised financial posting. Stop release; immediate triage.
- **P1 High:** core workflow blocked, incorrect report totals, RLS bypass, duplicate posting. Block milestone.
- **P2 Medium:** degraded feature with safe workaround. Fix before V1 release unless explicitly accepted.
- **P3 Low:** cosmetic or minor UX defect. May be scheduled after launch if documented.

## 10. Definition of tested

A test result must be reproducible and recorded with command/environment, date, pass/fail and relevant artifact. "AI reviewed it" or "build succeeded" alone is not sufficient evidence of financial correctness or privacy.
