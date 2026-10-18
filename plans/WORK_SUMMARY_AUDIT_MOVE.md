# Move Work summary to Audit Logs

Owner request: move Reports → Work summary into Audit Logs.

- [x] Move the summary component into the audit feature, using only the selected time window.
- [x] Add Entries / Work summary tabs under the existing audit access gate; use period dates for both and keep entry filters/export on Entries.
- [x] Remove the Reports tab and redirect old activity links, retaining dates.
- [x] Verify navigation, access, date filtering and existing analytics/admin checks; run typecheck, lint and build.

No backend contract or data changes. Existing Audit Logs role/scope rules govern the destination.

Validation: 61 tests pass across audit navigation/access, administration flows, PLA queries/hygiene and sidebar permissions. Frontend typecheck passes; lint has 0 errors and 234 existing warnings; production build and Docker frontend image build pass. The first test invocation was blocked by sandbox temporary-cache permissions; rerun outside the sandbox. A new dropdown assertion was corrected to check its visible label; a concurrent administration timeout passes in the final single-worker run.

Deployment: frontend container replaced with `sha256:7fa4401b0579d51bb7b860f8653e9005b8cb8c42ed5f837b1f650993a47178be`; frontend/API/worker and supporting services are healthy. Authenticated live browser interaction was not exercised; component tests cover the tab and legacy-link behavior.

Post-deployment verification inside nginx: `/audit?view=work-summary` and proxied `/api/health` return HTTP 200. Served `work-summary-D6KadDg5.js` contains the summary content.
