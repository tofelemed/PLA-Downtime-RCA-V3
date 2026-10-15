# Session startup and refresh follow-up

The two original browser observations remain unattributed: a finance login stalled after HTTP 200, and a Downtime reload missed its five-second session assertion although teardown later showed HDPE. The later full route sweep passed without increasing its waits. This repair addresses independently reproducible source failure paths; it does not establish the historical cause of either observation.

## Confirmed failure paths and repair

| Previous source behavior | Current behavior |
|---|---|
| Startup awaited profile/organization/plant responses without a deadline. Receiving headers did not bound reading the response body. | One 15-second startup/login deadline covers the complete operation, including body reads. It aborts outstanding transport work and settles even if a transport ignores cancellation. |
| Login credentials were saved only after directory reads completed. Metadata failure was conflated with incorrect credentials. | Successful authentication is persisted before metadata reads. Recoverable startup failure shows **Retry session** and **Sign out**; login infrastructure failure has separate copy and retains entered fields. |
| Restore could publish cached identity, grants and plant details after failed authorization reads. | Restore validates the current profile, then reads current directory details. Cached organization/plant snapshots are not used as authority or shown as a restored session. Missing profile scopes do not inherit saved grants. |
| Every refresh exception became `false`, letting a downstream 401 expire a valid session during an outage. | `false` means the refresh token is invalid. Transport, timeout and server failures reject without discarding credentials or an established session. Confirmed invalid refresh credentials still sign out. |
| A pending login, restore or refresh could finish after sign-out or a different login and republish state. | Cancellation and attempt ownership guard publication. Sign-out clears local state immediately, then attempts bounded server revocation. Late completions cannot restore the old identity. |
| A null token provider could fall back to an older stored token. Cache ownership covered tenant, not all identity/grant changes. | The installed token provider is authoritative. Requests reject responses from an obsolete session/plant; cache ownership includes user, role, home plant, organization and scopes. Saved plant selections are hidden when their owner no longer matches. |

Refresh remains deduplicated within a session. A successful rotation is persisted before subsequent metadata failure. A refreshed identity cannot replace the current user; loss of access to the displayed plant returns to recovery instead of keeping that plant visible. The public `selectTenant` action uses latest-choice ownership for overlapping reads; no current UI call site for that action was found.

The implementation is split between `src/features/auth/session-controller.ts` (state/attempt ownership), `session-requests.ts` (deadline and reads), and the small `AuthContext` adapter. `SessionRecovery` supplies the retry controls. No backend route, request DTO or response contract changed. Edited authentication/request code uses the frontend logger without emitting credentials, tokens or response bodies. The shared logger and API-base lookup tolerate Node tooling without Vite's `import.meta.env`.

## Retained verification

- `test-results/hdpe-followup/session-tests-final.json` and `.log`: **eight files / 62 tests passed**. Cases include slow and permanently missing responses, HTTP 200 headers with a missing body, metadata failure after successful login, retry and sign-out controls, refresh 503/timeout versus invalid credentials, concurrent refresh, denied storage, changed grants, late responses after logout, overlapping account logins and tenant choices. This is deterministic unit/component coverage with mocked transport; it is not a newly executed live-browser campaign.
- `session-typecheck-final.log`: complete frontend application, Node/config and E2E typechecking passed.
- `session-lint-final.log`: zero errors; two existing context-module fast-refresh export warnings remain. No new complexity warnings remain in the edited files.
- `session-first-tests.json` retains the initial sandbox Vite-cache `EPERM` startup failure: no test assertions ran. The approved external-sandbox retry and subsequent focused runs passed. Earlier intermediate passing results are retained separately and are not additive test counts.

The 15-second recovery deadline is an application behavior, not an increase to browser assertion waits. Startup adds a fresh profile read before directory reads, so it deliberately requires successful authorization read-back. No cached offline access is provided. Browser storage failure permits the in-memory session to continue but cannot guarantee restoration after a reload. If a refresh response is lost after the server rotates a token, recovery still depends on the server's refresh-token validity/grace rules; the browser does not invent credentials or bypass rejection.

After the coordinated local deployment, all four live browser regressions passed
(`session-browser-final.json/.log`): metadata outage after valid login and retry,
profile outage without a cached shell followed by sign-out, recoverable refresh
503, and invalid refresh 401 clearing the session. Browser interception simulated
the outage responses while successful login/retry used the real API. The first
attempt had three passes and one fixture selector failure: the button's actual
accessible name is “Secure sign in”. That evidence is retained separately.

The complete frontend suite passed 151 files / 887 tests with no skips in
`frontend-full-release.json`. The initial sandbox attempt could not collect tests
because temporary-cache renames returned EPERM; the authorized outside-sandbox
run passed. The final HDPE dataset has not been reset or reseeded for these checks.
