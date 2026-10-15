# MQTT profile and subscription layout — Stage 4

Prepared and implemented 16 October 2026 after the Stage 4 release. The product sources are frozen and included in the combined frontend build. Isolated browser layout checks and the final desktop/mobile visual review are complete.

## Existing ownership and contracts

`src/features/integration-console/mqtt/profile-editor.tsx` owns one `useProfileDraft(connection)`. The hook owns every profile field, local validation, merge-patch calculation, discard, and save. Its mutation sends only `{ payloadProfilePatch: patch }` through `useUpdateConnection` with the existing `If-Match` revision. Broker settings, topic subscriptions, secrets, API calls, polling, authorization, and restart behavior must retain their current contracts.

`mqtt-connection-panel.tsx` retains the URL-controlled Subscription / Payload profile / Quarantine tabs. The connection detail is already keyed by connection ID, preventing drafts from crossing connections. Wizard creation and transport editing remain separate workflows.

## Presentation structure

| Section | Existing fields | Default presentation |
| --- | --- | --- |
| Identity and schema | Topic template, schema version, identity strategy | Expanded; concise summary when collapsed |
| Time and quality | Timestamp unit, maximum future skew, maximum age, stale handling, quality protocol | Collapsible; summary of selected settings |
| Field overrides | Existing field/path rows and default-field reference | Collapsible; row count in summary; reference details nested separately |
| Value maps | State and reason maps, unmapped-reason handling, live token probes | Collapsible; state/reason row counts in summary |

Use one accessible disclosure component and keep child contents mounted when collapsed, so map probes and field edits survive disclosure changes. Reuse existing field IDs, test IDs, form controls, and draft callbacks. Section layout and status helpers belong under the MQTT feature directory; do not introduce a second form state, independent saves, or automatic writes.

One sticky action bar will expose **Save profile**, **Discard changes**, and a clear status: unchanged, unsaved, saving, validation required, saved, or save failed. Dirty or pending state takes precedence over a previous successful-save timestamp. Preserve the existing capability gate and save-disabled conditions. The application shell uses the document as its scroller, with a sticky 56-pixel header; use that existing layout rather than adding a nested scroll area. Ensure the bar does not obscure the last input or refusal at mobile widths. Keep the raw merge-patch preview available in collapsed technical details.

## Validation and error disclosure

The existing `DraftErrors` keys have explicit owners: topic template → Identity; future skew / maximum age → Time; fields → Field overrides; state / reason maps → Value maps. A section containing an error must reveal its message and fields rather than hide a blocked save. Use linked error descriptions and invalid-state attributes on the affected controls, plus a concise error count near the action bar.

Map actual server `V2ApiError.fieldErrors` paths to these same owners. The backend's `payload-profile.ts` emits `payloadProfile.*` problems and `integration-connection.service.ts` prefixes them with `endpointConfig.`: examples are `endpointConfig.payloadProfile.time.maxPastSeconds`, `endpointConfig.payloadProfile.fields.<field>`, and `endpointConfig.payloadProfile.valueMaps.state.<token>`. Whole-patch contract refusals use `payloadProfilePatch` and stay at the form level. Do not reuse the wizard's broad profile fallback, which sends unknown profile paths to the topic-template field. A server 422 reveals its owning fields while retaining the user's draft. A 412 stale-revision refusal retains the draft and the existing conflict behavior; it must not trigger an automatic retry or overwrite. Unknown errors remain visible through `ConsoleRefusal`.

## Subscription health

Keep the existing `subscriptionStatus` / `mqttHealthOf` result authoritative. The primary surface should show the health and job-state badges, source availability, pending restart, failure detail, last observation, last message, last persist, heartbeat, in-flight count, and reconnect count. Persist failures and an unavailable source must remain prominent even when technical details are collapsed.

Move the effective client ID, session-present flag, lease owner/expiry, subscribed filters, and last availability-message timestamp into a clearly labelled disclosure. Preserve every fact and the seven existing Received / Accepted / Duplicate / Stale / Conflict / Quarantined / Parked counters. Retain `PlantTime`, `DurationText`, and the existing clock/polling lifecycle; avoid a live region that announces every age tick. Command availability, audit reasons, confirmation dialogs, and job transitions are unchanged.

## Regression plan

1. Extend profile component tests for edits across all four sections, collapse/reopen retention, one exact PATCH body and `If-Match`, complete discard, clean/dirty/pending/saved/failed states, and capability gating.
2. Cover local errors in collapsed sections, actual server 422 field paths, and 412 refusal with the draft retained and no repeat mutation. Check accessible disclosure controls and field/error associations.
3. Add subscription presentation tests proving operational health remains visible with technical details collapsed, persistence failure never appears healthy, offline source warnings remain visible, and counters / command gates are unchanged.
4. Retain the existing MQTT model tests, wizard create/error tests, and profile merge-patch test. Update only visibility interactions in existing browser tests when a field moves behind a disclosure; preserve all payload, transport, revision, refusal, and persistence assertions.
5. Run focused Vitest, changed-file lint, and the shared frontend typecheck. Then run the existing MQTT subscription/profile browser file serially in the parent's approved mutation slot, followed by keyboard, desktop and 390-pixel mobile checks of the profile and subscription pages.

The existing browser file `e2e/personas/integration-04-mqtt-subscription.spec.ts` already checks live intake and counters, pause/resume, audit, profile validation, merge patch, 422/412 refusals, unchanged transport topics, revision/restart, and persistence after a new login. It will need explicit disclosure expansion before state-map edits and session-present assertions.

## Baseline and release conditions

The parent's `frontend-full-release.json` contains a passing MQTT baseline: `mqtt-flows.test.tsx` **3 tests** and `mqtt-model.test.ts` **18 tests**. The extracted reference is `test-results/hdpe-followup/mqtt-stage4-baseline.json`. These are existing tests, not evidence for the proposed layout.

Acceptance requires unchanged API/transport behavior, one retained draft and save, visible actionable errors, readable health with details collapsed, and no keyboard/mobile obstruction. This stage does not change the backend, ingestion pipeline, MQTT publishing ownership, or database.

## Implemented checks

The profile now has the four planned disclosures, one sticky save/status bar, retained controls and probes when collapsed, and mapped server field errors that reveal their owning section. Subscription health keeps operational facts and failures visible; technical connection facts are available in a separate disclosure. Existing draft, mutation, version, polling and transport modules were not changed.

Focused Vitest passes **5 files / 49 tests**: the existing 21 cases plus 8 profile-layout, 4 subscription-layout and 16 server-field mapping cases. Evidence: `test-results/hdpe-followup/mqtt-stage4-tests-final.json` and `.log`. The full app, Node/config and E2E typecheck passes (`mqtt-stage4-typecheck-final.log`). All 15 changed MQTT and E2E files pass lint with zero errors or warnings (`mqtt-stage4-changed-lint.log`). The broader MQTT scan has zero errors and 9 warnings in untouched existing files (`mqtt-stage4-lint-final.log`). The scoped diff check passes.

`e2e/mqtt-console.spec.ts` and `e2e/personas/integration-04-mqtt-subscription.spec.ts` now explicitly open **Value maps**, **Technical connection details**, and **Technical details: pending profile changes** when their existing checks need those fields or facts. Payload, revision, transport and persistence assertions remain unchanged. The parent-owned `hdpe-mqtt-workspace` browser cases add desktop/mobile layout and disclosure checks. Their execution and screenshots are recorded separately after deployment.

The final read-only layout capture passed all **8 cases** across month close and MQTT with no skips or retries (`test-results/hdpe-followup/ui-final-visual.json`); two of those cases cover MQTT at 1280 and 390 pixels. All six MQTT images under `ui-final-visual-artifacts` were inspected: collapsed and expanded profile, plus subscription health at each width. No actionable clipping, overlap or unreadable control was found. Mobile controls stack, counters wrap, and technical facts remain distinct from health. Sticky shell/save bars appear at the scrolled position in the full-page captures. The isolated fixture's inactive connection and expired worker lease are shown explicitly, not represented as healthy live intake. This visual acceptance does not certify a real external broker or plant feed.
