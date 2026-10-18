# Pending approvals inbox

- [x] Add a read-only, plant/scoped-role filtered, keyset-paged approval inbox API.
- [x] Add Overview > Pending Approvals with record review links and existing lifecycle commands.
- [x] Cover setup, finance, quality, metrology, source ownership, plans and operational review workspaces.
- [x] Verify role/scope isolation, SuperAdmin independence, pagination, UI actions and API contract.
- [x] Update the extruder guide and deploy the verified application.

Decisions: `/approvals` is a shared Overview screen. Pending drafts are included for versioned resources without a submission step. Retire is available only for workflows whose existing backend supports retiring drafts. Reconciliation, RCA, month close and duplicate-stop decisions open their existing detailed workspace. No bulk approval, automatic supersession or bypass of lifecycle/data gates. New read API `/api/v2/approval-inbox`; all mutations reuse existing audited domain commands.

Verification before deployment: backend typecheck, six access/cursor unit tests and OpenAPI snapshot passed; ten approval-inbox integration tests passed on isolated `proact_test`, covering finance/quality/metrology/source roles, tenant/unit/site isolation, SuperAdmin and ordinary author independence, approve/retire/reject disappearance, keyset pagination, month routing, and index EXPLAIN. Full migration round trip/parity passed (six tests). Frontend typecheck/API type parity and lint passed (zero errors, existing warnings); 198 focused frontend tests passed before the final stale-record regression was added. No live plant data was seeded.

Final verification (17 October 2026): the additional stale-record regression passes; the final inbox UI suite has ten tests. Backend/frontend production images built successfully and frontend/API/worker were recreated healthy. Direct/proxied health return 200 with database connected; unauthenticated inbox API returns 401. Migration `ApprovalInboxIndexes1794190800000` is applied and all 22 new indexes are present. Frontend serves `index-HVjmwsW7.js` and lazy `approval-inbox-page-Oa0uZlvP.js`; initial transfer is 191,689 bytes gzip over five JS chunks. Authenticated live browser rendering remains unverified; permission/action behavior was verified through isolated integration and component tests. No live record was approved, retired or seeded for verification.

## Follow-up: remove decided records immediately

- [x] Evict a successfully decided record from every cached inbox filter/page before refetching.
- [x] Refresh active inboxes and discard inactive inbox snapshots after other workflow changes.
- [x] Verify approval, retirement, failed decisions, cached pages, tenant isolation and return from another workspace.
- [x] Deploy the frontend update and record verification.

The backend pending predicates are already correct. This follow-up addresses cache freshness; it introduces no workflow or API changes. Confirmed decisions remove rows only after server success. Existing records and audit history remain intact.

- [x] Clarify that the role column names the workflow requirement and SuperAdmin can act for every role, including review-stage workspaces.

Follow-up verification (17 October 2026): 52 focused frontend/API-cache tests pass, including immediate removal during a delayed refetch, retirement of the last item on a later page, failed decisions retaining rows, pre-decision response cancellation, cross-workspace invalidation, plant isolation and SuperAdmin role/review labels. Frontend typecheck and lint pass (0 errors, 234 existing warnings). The production frontend was rebuilt and recreated healthy; API and worker remain healthy on their existing image. Served entry `index-sAQDrjf1.js` and lazy inbox `approval-inbox-page-DcRCiSjg.js` include the new role wording. Initial transfer is 191,869 bytes gzip over five JS chunks. No migration or live plant data changes were needed. Authenticated browser rendering remains unverified.
