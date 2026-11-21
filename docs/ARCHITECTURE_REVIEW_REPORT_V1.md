# POCKA V1 — Architecture Review Report

**Review date:** 2026-11-21  
**Scope:** Documentation-only review of PR #4 and its database/finance design package  
**Disposition:** Remediated at design level; owner decisions and implementation gates remain open  
**PR:** https://github.com/krellynn/pocka-personal-finance/pull/4

## 1. Executive result

The review identified 12 findings spanning household paired posting, departed-member access, idempotency, FX rate visibility, contribution accounting, category/CoA design, RLS coverage, FX carrying value, money serialization, reversal semantics, data dictionary completeness, and pocket eligible funds.

The planning documents have been updated to make technical contracts explicit and remove cross-document ambiguity. This is **not** a declaration that all 12 are fully approved or implementation-ready. Findings that require a product/finance choice remain open and are called out below. The package remains conceptual; no executable SQL, application code, dependencies, migrations, cloud resources, secrets, or deployments were created.

## 2. Finding-by-finding disposition

| ID | Severity | Finding | Remediation | Status |
|---|---|---|---|---|
| R-01 | Critical | Household paired entries could leave one side posted and the other failed | Durable pair intent, opaque correlation ID, per-side state/idempotency, retry, reconciliation and audited compensation; atomic single-transaction option only if proven safe | Design contract documented; G5 approval/test required |
| R-02 | Critical | Departed member needs obligations without regaining household access | Narrow obligation endpoint bound to auth.uid(), specific obligation ID, minimal response, audited locked settlement; ordinary RLS remains revoked | Design contract documented; G5 approval/test required |
| R-03 | Critical | Transaction uniqueness and command idempotency did not match | Canonical (workspace, operation, key) plus request fingerprint; replay identical retries; reject changed payload; serialize concurrent duplicates | Contract documented |
| R-04 | High | Global and workspace manual FX rates shared broad RLS treatment | Separate global published read-only policy from exact-workspace manual-rate policy; controlled ingestion/writes | Policy boundary documented; SQL/RLS tests required |
| R-05 | High | Personal side of contribution-intent direct payment absent from posting matrix | Personal Dr Household Contribution expense / Cr Personal asset paired with household Dr Household expense / Cr Member Contribution Funding; not a household cash transfer | Posting pair documented; CoA classification still pending |
| R-06 | High | Category as ledger account vs dimension unresolved | Two mutually exclusive models documented; dimension model recommended for review, not approved | Owner/finance decision pending G2 |
| R-07 | High | RLS matrix too coarse | Added table-by-table SELECT/INSERT/UPDATE/DELETE baseline with visibility and lifecycle boundaries | Baseline documented; convert to exact SQL/grants/tests before G2/G5 |
| R-08 | High | FX carrying-value method unresolved | Weighted-average, FIFO and transaction-linked methods retained as candidates with required worked cases | Owner/finance decision pending |
| R-09 | Medium | Money wire format inconsistent across documents | All JSON monetary values are integer minor-unit decimal strings, regardless of size; parse to bigint | Proposed API contract aligned; ratification at G2 |
| R-10 | High | Reversal semantics did not cover multiple journal entries | Transaction-level complete reversal set, locking, one-time constraint, immutable original, linked replacement and idempotent retry | Contract documented; posting tests required |
| R-11 | High | Data dictionary not migration-ready | Defined mandatory column/type/nullability/default/constraint/index/FK/RLS/write-path/lifecycle/retention/test deliverable | Remains required G2 deliverable |
| R-12 | High | Pocket eligible-funds edge cases unresolved | Option A remains recommended review candidate; overdraft, FX, archived account, shortfall, concurrency and household funds enumerated | Owner decision pending before pocket implementation |

## 3. Cross-document consistency corrections

- D-11 RPC-only financial mutations remains **Proposed**, pending explicit G2 approval. DEVELOPMENT_GUIDELINES, DOMAIN_AND_API_CONTRACTS, PRODUCT_OWNER_DECISIONS and the finance design pack now state this consistently.
- D-12 money wire format is a proposed contract: all JSON monetary values use integer minor-unit decimal strings. It is not a change to the approved BIGINT database storage decision in ADR-001.
- The earlier unique (workspace_id, idempotency_key) is no longer treated as a complete request contract; operation scope and payload fingerprint are required.
- Global and workspace manual FX rate access are separated.
- Contribution-intent direct payment now has both personal and household accounting legs.
- Household exit privacy and surviving obligations are explicitly separated.
- The report is indexed from README, PROJECT_STATUS and the Master Development Package.

## 4. Decisions still requiring owner/finance approval

1. **D-09:** category dimension vs category-to-ledger-account mapping; final CoA.
2. **D-10:** final posting matrix and worked examples.
3. **D-11:** approve RPC-only financial mutations at G2.
4. **D-12:** ratify the integer-minor-unit decimal-string JSON contract.
5. **D-16:** pocket eligible funds and shortfall rules.
6. **D-18/D-19:** FX carrying-value method and rate provider/manual fallback.
7. **D-20/D-21:** household base currency and operation-specific role matrix.
8. **D-22/D-23:** paired-entry orchestration and obligation-only departed-member access.
9. **D-24:** household account ownership and visibility.
10. **D-31 and operational decisions:** deletion/retention, backup/restore objectives, monitoring and production operations.

The column-level data dictionary and exact SQL RLS policy expressions are required design artifacts, not claims of completion.

## 5. Readiness assessment

- **G0 — Foundation:** separate review still required for package manager, i18n/query strategy, onboarding/workspace creation, Supabase/Cloudflare setup and preview workflow. This review does not authorize Phase 0B.
- **G2 — Finance core:** not ready for approval until D-09–D-18 decisions, final data dictionary, exact RLS expressions, RPC contracts and worked tests are approved.
- **G5 — Household:** not ready until D-20–D-25 are resolved and pair/exit/privacy acceptance tests pass.
- **G6 — Import:** format, limits, dedupe, retention and partial-commit decisions remain open.
- **G7 — Production:** deletion/retention, backup/restore, monitoring and deployment rehearsal remain open.

G0 may be approved independently of G2 if its own scope and dependencies are complete. Ledger implementation remains gated by G2; household implementation remains gated by G5.

## 6. Scope and verification

This was a documentation review and remediation. No application code or infrastructure was changed. The PR remains open and draft; it has not been merged. A follow-up read-only consistency check was completed on the updated branch. The reviewed documents contain the new contracts and readiness boundaries; remaining items are explicitly recorded as pending owner decisions or required gate deliverables.

