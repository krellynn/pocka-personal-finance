# POCKA V1 — Architecture Review Report

**Review date:** 2026-11-21  
**Scope:** Documentation-only review of PR #4 and its database/finance design package  
**Disposition:** Design findings remediated; approved owner decisions recorded; implementation gates and detailed contracts remain open  
**PR:** https://github.com/krellynn/pocka-personal-finance/pull/4

## 1. Executive result

The review identified 12 findings spanning household paired posting, departed-member access, idempotency, FX rate visibility, contribution accounting, category/CoA design, RLS coverage, FX carrying value, money serialization, reversal semantics, data dictionary completeness, and pocket eligible funds.

The planning documents have been updated to make technical contracts explicit and remove cross-document ambiguity. This is **not** a declaration that all 12 findings are implementation-ready. Approved product decisions are distinguished from remaining detailed contracts and implementation gates below. The package remains conceptual; no executable SQL, application code, dependencies, migrations, cloud resources, secrets, or deployments were created.

## 2. Finding-by-finding disposition

| ID | Severity | Finding | Remediation | Status |
|---|---|---|---|---|
| R-01 | Critical | Household paired entries could leave one side posted and the other failed | Durable pair intent, opaque correlation ID, per-side state/idempotency, retry, reconciliation and audited compensation; atomic single-transaction option only if proven safe | Design contract documented; G5 approval/test required |
| R-02 | Critical | Departed member needs obligations without regaining household access | Narrow obligation endpoint bound to auth.uid(), specific obligation ID, minimal response, audited locked settlement; ordinary RLS remains revoked | Design contract documented; G5 approval/test required |
| R-03 | Critical | Transaction uniqueness and command idempotency did not match | Canonical (workspace, operation, key) plus request fingerprint; replay identical retries; reject changed payload; serialize concurrent duplicates | Contract documented |
| R-04 | High | Global and workspace manual FX rates shared broad RLS treatment | Separate global published read-only policy from exact-workspace manual-rate policy; controlled ingestion/writes | Policy boundary documented; SQL/RLS tests required |
| R-05 | High | Personal side of contribution-intent direct payment absent from posting matrix | Personal Dr Household Contribution expense / Cr Personal asset paired with household Dr Household expense / Cr Member Contribution Funding; not a household cash transfer | Posting pair documented; CoA classification still pending |
| R-06 | High | Category as ledger account vs dimension unresolved | Categories remain separate dimensions; CoA holds stable accounting/control accounts | **Resolved by approved D-09 Option A**; final CoA mappings remain G2 work |
| R-07 | High | RLS matrix too coarse | Added table-by-table SELECT/INSERT/UPDATE/DELETE baseline with visibility and lifecycle boundaries | Baseline documented; convert to exact SQL/grants/tests before G2/G5 |
| R-08 | High | FX carrying-value method unresolved | Weighted-average, FIFO and transaction-linked methods retained as candidates with required worked cases | Owner/finance decision pending |
| R-09 | Medium | Money wire format inconsistent across documents | All JSON monetary values are integer minor-unit decimal strings, regardless of size; parse to bigint | **Resolved by approved D-12 Option A**; detailed payload schemas remain G2 work |
| R-10 | High | Reversal semantics did not cover multiple journal entries | Transaction-level complete reversal set, locking, one-time constraint, immutable original, linked replacement and idempotent retry | Contract documented; posting tests required |
| R-11 | High | Data dictionary not migration-ready | Defined mandatory column/type/nullability/default/constraint/index/FK/RLS/write-path/lifecycle/retention/test deliverable | Remains required G2 deliverable |
| R-12 | High | Pocket eligible-funds edge cases unresolved | Option A defines eligible funds and shortfall handling; FX conversion details remain tied to D-18/D-19 | **Resolved by approved D-16 Option A**; FX basis and implementation tests remain gated |

## 3. Cross-document consistency corrections

- D-11 RPC-only financial mutations is **Approved — Option A**. The mutation boundary is binding; exact RPC names/signatures, grants, function security hardening, RLS SQL and tests remain G2 deliverables.
- D-12 money wire format is **Approved — Option A**: all JSON monetary values use integer minor-unit decimal strings. This does not change the approved BIGINT database storage decision in ADR-001.
- The earlier unique (workspace_id, idempotency_key) is no longer treated as a complete request contract; operation scope and payload fingerprint are required.
- Global and workspace manual FX rate access are separated.
- Contribution-intent direct payment now has both personal and household accounting legs.
- Household exit privacy and surviving obligations are explicitly separated.
- The report is indexed from README, PROJECT_STATUS and the Master Development Package.

## 4. Decisions and deliverables still open

Approved decisions are not reopened by this report. Remaining choices and implementation deliverables are:

1. **D-18/D-19:** FX carrying-value method and rate provider/manual fallback.
2. **D-20/D-21:** household base currency and operation-specific role matrix.
3. **D-22/D-23:** paired-entry orchestration and obligation-only departed-member access; validate documented contracts with G5 acceptance tests.
4. **D-24:** household account ownership and visibility.
5. **D-31 and operational decisions:** deletion/retention, backup/restore objectives, monitoring and production operations.
6. **G2 deliverables:** final CoA/system mappings and worked posting examples under approved D-09/D-10; exact RPC names/signatures, grants and function hardening under approved D-11; column-level data dictionary, exact RLS SQL and executable tests.
7. **D-17:** partially approved edge-case decisions; calculation, schedule-recalculation and exception details remain G2 deliverables.

The column-level data dictionary and exact SQL RLS policy expressions are required design artifacts, not claims of completion.

## 5. Readiness assessment

- **G0 — Foundation:** foundational choices D-01–D-07 are recorded as approved in the decision register. The Phase 0B scaffold merged via PR #5 (`a930ad7`); local typecheck/lint/test/build passed. Cloudflare plugin/preview and visual/accessibility checks remain before deployment or expanded scope.
- **G2 — Finance core:** approved decisions D-09–D-16 provide the product/architecture baseline. G2 is still not ready for financial implementation until remaining choices (including D-18/D-19), final data dictionary, exact RLS expressions, RPC contracts/grants/security hardening and worked tests are completed and reviewed.
- **G5 — Household:** not ready until D-20–D-25 are resolved and pair/exit/privacy acceptance tests pass.
- **G6 — Import:** format, limits, dedupe, retention and partial-commit decisions remain open.
- **G7 — Production:** deletion/retention, backup/restore, monitoring and deployment rehearsal remain open.

G0 may be approved independently of G2 if its own scope and dependencies are complete. Ledger implementation remains gated by G2; household implementation remains gated by G5.

## 6. Scope and verification

This was a documentation review and remediation. No application code or infrastructure was changed by PR #4. The Phase 0B scaffold has since merged via PR #5 and passed local verification. The product owner approved the planning checklist on 2026-11-22; the reviewed documents distinguish recorded decisions from remaining G2/G5/G6/G7 implementation deliverables.

