# QA audit: RCA (investigations, analysis, actions, policy, knowledge base)

Agent: RCA · run 2026-10-19 (plant time) · plant Marun / HDPE plant (HDPE-TRAIN), unit HDPE Extruder 1, closed investigation `f58df7af-1b09-4d08-b41a-560c5bfd1fd3`.

Method: headless Chromium from the repo's `playwright` package, with a UI login per user (farid, omid, leila, maryam, sara). The capture for each page is URL, h1 and document.title, h2/h3, console errors, failed requests (≥ 400), axe serious/critical (wcag2a/aa), "demo" text, raw uuids and snake_case words, and a screenshot. Pages were captured at 1440×900, with a 768×1024 pass as Farid. In the role, policy-form, recommendation-dialog and evidence passes, a route guard blocked every API POST/PATCH/PUT/DELETE. Forms were only filled, validated and then cancelled or discarded. Database reads were read-only SQL, used to explain two findings.

Evidence (scripts, `results.jsonl` with 173 page captures, the `shots/` screenshots and the `dl/` exports) is in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\rca\`. Screenshot names below are files in `shots\`.

## Summary

| Result | Count |
|---|---|
| Checks PASS | 46 |
| FAIL | 0 Critical, 1 High, 4 Medium |
| WARN | 2 Medium, 17 Low |

- **No console errors, failed requests or axe serious/critical violations** on any of the 173 captures. The one exception is an uncaught clipboard rejection from "Copy link" (L13). No "demo" text and no raw uuid appear in page text. At 768 px there is no page-level horizontal scroll; wide tables scroll inside their own container.
- **Figures are correct**: approved loss 28.00 t / 4,200.00 USD (IRR 2,520,000,000 on Bad actors, which is 600,000 × 4,200). The Shift C stop shows 14.00 t / 2,100.00 USD and its time 2026-10-18 02:00 → 02:30 (22:30Z–23:00Z in Asia/Tehran), 30 min. History has 42 entries with names (41 Farid, 1 Maryam) in plant time. The policy shows v2 with 600 run hours (Reza, 2026-10-18 19:48) and minimum coverage 95 % (form only).
- **Top problems:**
  1. A closed investigation can still be edited by RCA writers (Farid, Maryam): analysis tools, definition, evidence edit/delete, action status, recommendations and tasks.
  2. The case was changed after closure without an audit entry.
  3. The Links page labels the same approved loss with two different valuation views.
  4. A "Verified" badge sits on an action whose verdict is "Not enough evidence yet".
  5. Exports are incomplete.

### Key facts verified

| Fact | Expected | UI | Result |
|---|---|---|---|
| Case header | Closed · High · HDPE Extruder 1 · target 2026-11-30 · Approved loss 28 t / USD 4,200 | "Closed · High · HDPE Extruder 1 · opened 2026-10-18 · target 2026-11-30 · closed 2026-10-18 · Triggered by: Downtime from 2026-10-17 08:00 · Approved loss 28.00 t / 4,200.00 USD" | PASS (term: L1) |
| List row | Lead, Trigger, Actions progress columns | "Closed · High · Farid · HDPE Extruder 1 · Event 2026-10-17 08:00 · 2/2 done · 2026-11-30 · 2026-10-18" | PASS |
| Stepper / checklist | 6 stages, Closed current; 5 checklist items done | Draft → In Progress → Analysis → Monitoring → Closure Review → Closed; Definition, Data collection (4 evidence), Analysis, Actions (2 of 2 done), Closure all done | PASS |
| Closure | requested by Farid, approved by Maryam | "Farid, 2026-10-18 18:11" / "Maryam, 2026-10-18 18:11" with residual risk and note | PASS |
| Outcome | 3 separate figures | Approved historical 28.00 t / 4,200.00 USD; claimed avoided 4,200.00 USD (1 action); realized 0.01 recurrences "Not enough evidence yet"; "never added up" | PASS |
| Actions | verification method / verifier, verdict + coverage | Corrective: "Done on 2026-10-17, evidence checked by Farid", "No verification planned". Preventive: baseline 2026-07-20 – 2026-10-18 (1 incident, 2,159 run h), "Not enough evidence yet, needs 720 run hours after the action, has 17.7" | PASS (see M2, L11) |
| History | ≥ 39 field-level entries with names | 42 entries, 3 pages of 20, newest first, plant time | PASS (see L8) |
| Policy | min run hours 600, min coverage 95 % | Summary "at least 600 run hours after". Maryam's form: "Minimum run hours after the action = 600", "Minimum state-data coverage for a verdict (%) = 95" | PASS (see L9) |
| New investigation prefill (Shift C stop) | title / problem statement, event card | Title "HDPE Extruder 1 · Stop · 2026-10-18 02:00". Problem "Stop on HDPE Extruder 1 from 2026-10-18 02:00 to 2026-10-18 02:30, 30 min. No reason recorded yet." Card: no asset, 30 min, "Not coded yet". Evidence package 5 revisions, 14.00 t / 2,100.00 USD. Similar past RCAs lists the closed case | PASS |

## Findings by page

| Page / route | Role | Checks run | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| Case workspace, all tabs `/rca/:id/*` (Closed) | farid, maryam (RCA writers) | controls on a closed case | **FAIL** | **H1. A closed investigation is fully editable for RCA writers.** The 5-Why, fishbone, FMEA, timeline and event diagram show enabled Save / Add / Remove / Edit / Delete. The definition is editable, and "Save case" becomes enabled after typing (discarded; not saved). Evidence detail offers Edit and Delete. The action status `<select>` is enabled for Maryam, and the completion form and "Save evidence" are visible. "Create investigation task" and "Create task from recommendation" are enabled. Only Links ("This investigation is closed: reopen it to add a link") and Causes ("locked once closure is requested") are locked. `readOnly` is `!canWriteRca` only (`case-workspace-page.tsx:59`). `rca-analyses.service.ts` has no status guard, so the server most likely accepts the save as well (not exercised). A closed, independently approved record can be changed without reopening | c-tool-five-why.png, c-tool-fishbone.png, c-tool-fmea.png, d-definition-dirty.png, e-detail-0.png, r-maryam-case-actions.png; s3.txt, s4.txt | High | Derive `readOnly` from status as well (Closure Review / Closed → read-only, like links and causes). Enforce the same rule on the server for analyses, definition PATCH, evidence, actions, recommendations and tasks (`src/features/rca/case/case-workspace-page.tsx`, `server/.../rca-case/rca-analyses.service.ts`, `rca-case-writer.ts`) |
| Case (data) | — (SQL read) | audit trail after closure | **FAIL** | **M1. Changed after closure without a History or audit entry.** `rcas.updated_at` = 2026-10-18 18:47:28Z and `row_version` = 22, but the last `audit_log` row is revision 21 (`rca_case.closed`, 14:41:47Z), and the History tab ends at the closure. The JSON export also shows `updatedAt 2026-10-18T18:47:28Z`. Something wrote the closed case without an audit row | SQL `rcas`, `audit_log`; dl/…-case.json | Medium | Find the writer (a maintenance script or a non-audited path) and route every `rcas` write through the audited writer. Together with H1 |
| Links & outcome `/rca/:id/links` | farid, all | links, evidence package, outcome | **FAIL** | **M3. The same approved loss is labelled with two valuation views on one page.** The link's evidence package says "Value: Economic impact … economic impact view … (the policy default, SME V8)". The Outcome panel says "Value: Contribution margin … contribution margin view (the policy default, SME V8)". Both show 4,200.00 USD and both claim to be the policy default. The evidence package is frozen at link time, but it does not say so. Also, the basis text starts lowercase ("1 approved line(s). approved plan lines …") and shows an internal reference ("SME V8") to users | k-links-expanded.png; s4.txt | Medium | Label the frozen package "at link time (policy vN)" and drop "the policy default" from it. Remove "SME V8" from user text (`server/.../rca-case/approved-impact.ts:40`) |
| Recommendations & actions `/rca/:id/actions` | all | action rows, verdict, badges | **FAIL** | **M2. The "Verified" badge contradicts the verdict.** The preventive action has the badge "Verified" while its verdict is "Not enough evidence yet · needs 720 run hours, has 17.7". The label maps `verificationStatus = evaluated` to "Verified" | omid-case-actions-expanded.png | Medium | Rename to "Evaluated" / "Verdict recorded", or show the verdict in the badge (`src/features/rca/model/rca-labels.ts:23`) |
| Export menu (JSON / CSV) | farid | downloads and content | **FAIL** | **M4. Exports are incomplete** (still open from the E2E report). The JSON has the definition, evidence, logic tree, diagram, recommendations, actions, causes, links, outcome and closure, but **no 5-Why, fishbone, FMEA, fault tree, barrier or change analyses and no history**. There is no actions CSV. The evidence CSV has the raw task status `completed` (the UI shows "Completed") and empty Category/Location columns, with no observed time, asset or file count. All three downloads work and are named after the case | dl/rca-…-case.json (18 kB), …-evidence.csv, …-recommendations.csv | Medium | Add analyses and history to the JSON, add an actions CSV, and use display labels in the CSV (`src/features/rca/model/case-export.ts`) |
| `/rca` list | farid, leila, maryam, sara | tabs, chips, filters, search, paging, deep link, empty states | PASS | Chips are toggle buttons (`aria-pressed`) that set the URL (`?status=Closed`, `?due=overdue`, `?priority=Critical&open=true`). Status, priority, target date and open/closed filters persist in the URL and survive a reload. Search `?q=` works, and the empty state reads "No investigations · No investigation matches these filters…". The pager is hidden when everything fits (by design, `isPagerHidden`). Paging was verified on History | l-chips.png, l-filter-*.png, l-search-empty.png; s2.txt | — | — |
| `/rca` status filter | farid | wording | WARN | L2. The status options include "Published (older investigation)", a legacy value with no investigation in this plant. Statuses are Title Case ("In Progress", "Closure Review") while the app uses sentence case ("In review") | s2.txt | Low | Hide statuses with no rows; use sentence case in `STATUS_LABELS` |
| `/rca?tab=actions` | farid / leila / maryam / sara | Mine / Overdue / status / unit | PASS | "Mine" defaults on. For Farid it shows "No actions · You own no action that matches these filters. · Reset filters". With Mine off (`&mine=false`) both actions show with owner, due and Done. Leila sees her preventive action | l-actions-all.png | — | — |
| `/rca?tab=recommended` | farid, maryam | rows, dialogs | PASS | Shift C stop "Large lost quantity · RCA policy v1 · lost 14.00 t (limit 6.72 t)", recommended 2026-10-18 17:05. "Create investigation" / "Link to existing" link to `/rca/new?eventId=…[&mode=existing]`. The Dismiss dialog requires a reason (Reason*), and Cancel works (not dismissed). Sara and Leila get no write buttons | rec-Dismiss.png; s10.txt | — | — |
| `/rca?tab=recommended` | all | terms | WARN | L1a. The row reads "Event on HDPE Extruder 1" for a downtime event. The glossary says one record of kind downtime takes "Stop" (`eventNoun`) | list-recommended.png | Low | Use `eventNoun(kind)` |
| Case header, Links | all | terms | WARN | L1. "Triggered by: Downtime from 2026-10-17 08:00" and "Event Downtime from …": should be "Stop from …". Other non-glossary terms: "Save case" (glossary: not "case"), "Start RCA" (Bad actors), "Similar past RCAs", "Create / link RCA" (event page). The glossary keeps "RCA" only for the module and nav item | c-overview, k-0.png | Low | Use "Stop" / "investigation" wording |
| Recommendations vs actions | all | status labels | WARN | L3. A recommendation is "Completed" (grey badge), an action is "Done" (green), and an evidence task is "Completed". The same state uses two words and two tones | case-actions.png | Low | Pick one ("Done") and one tone |
| Overview `/rca/:id` | all | stepper, checklist, workflow | PASS | Stepper and checklist are correct. Effectiveness is "Not enough evidence yet (frozen when closure was requested)". Maryam sees "Reopen the investigation", disabled until a reason is entered ("Required for these moves: say why, in a sentence."). Non-writers see only Export | c-overview, mc-0.png | — | — |
| Definition `/rca/:id/definition` | farid | form, unsaved guard | WARN | L4. After an edit, "Discard changes" asks "Discard your changes?" (good). Leaving through a workspace tab with unsaved edits shows no prompt. The draft stays and the browser later fires `beforeunload`, so nothing is lost, but the user is not told a draft is pending | d-discard-dialog.png; s4.txt | Low | Show the draft notice on the other tabs, or prompt on in-app navigation |
| Evidence list / detail `/rca/:id/evidence[/ev-n]` | farid, omid, sara | list, counts, detail, deep link | PASS | Counts: Photo 1, Document 2, Video 0, Note 0, Time Series 1. Each row shows task, assignee, due, status and Verified. The detail shows observed time, asset, 5P, "Verified by Farid at 2026-10-18 17:53", task and files (2 PNGs with Download), and the deep link reloads. For ev-1 (Time Series) the "Time series" section says "No historian query recorded" | e-detail-0..3.png | — | — |
| Analysis index `/rca/:id/analysis` | all | 9 tools, causes | PASS | Status per tool (Saved / n events / Not started). Root, direct and contributing causes are coded (ME-INSPECTION-GAP, MAT-LUBE-CONTAM, ME-OIL-LIMITS) with evidence | case-analysis.png | — | — |
| Tool pages (timeline, fishbone, 5-Why, FMEA, fault tree, barrier, change, logic tree, event diagram) | omid, leila, sara (read-only) / farid | content, read-only | PASS (non-writers) / FAIL (writers, see H1) | Timeline 6 entries in order (04-15 10:00 … 10-17 09:00). Fishbone 5 causes, 2 primary. 5-Why 5 levels with evidence and the root cause. FMEA RPN 280 "priority high · needs action" and RPN 56. Fault tree, barrier, change and logic tree "Not started". For non-writers every input is disabled | c-tool-*.png, r-omid-case-5why.png | — | — |
| Timeline | all | terms | WARN | L5. The linked stop shows as "2026-10-17 08:00 · ProductionLoss": a raw entity name instead of "Stop · Gearbox failure". Every item reads "0 evidence" although the analysis cites ev-1…ev-4 | c-tool-timeline.png | Low | Label linked events with kind and reason (`timeline-tool.tsx`) |
| Event diagram | farid | connections | WARN | L6. "No connections yet": the 5 events are not connected, though the Marun walkthrough expected a causal chain. The diagram also shows the "React Flow" attribution | c-tool-event-diagram.png | Low | Data/training note. Consider hiding the attribution under the licence terms |
| Links evidence package / KB detail | all | raw keys | WARN | L7. "Cause MECH-GEARBOX Gearbox failure · GEARBOX_FAILURE" and the KB "Failure mode: GEARBOX_FAILURE" show the raw failure-mode key. The trend window "2026-10-17 07:00 (+03:30 Asia/Tehran) – …" uses a different date style from the rest of the app | k-links-expanded.png, kb-detail.png | Low | Show the failure-mode label; use the plant date-time formatter |
| History `/rca/:id/history` | all | entries, names, paging | WARN | L8. The 42 entries are correct, but "Changed:" lists internal fields ("ID, RCA ID, Tenant ID, Investigator ids, Target ID, Created by"). "Cause code: none → a cause code" hides which code. Many entries read only "Investigation details changed · Changed: Evidence". The pager reads "1–20 · Page 1" with no total until the last page (keyset) | h-0.png, h-page2.png, h-page3.png; history.txt | Low | Filter technical fields; show the code value (`rca-history.service.ts`, `history-entry-item.tsx`) |
| RCA trigger settings `/events/rca-triggers` | farid, omid, leila, sara (read); maryam (form) | summary, version history, form validation | WARN | L9. The read-only summary does not show the 95 % minimum coverage (only the form does). "Methods by consequence" shows raw keys ("five_why or fishbone or logic_tree …"), in both the summary and the form. Version 1 is shown "From 1970-01-01 03:30" (epoch) for the built-in default. In the form, coverage 150 % disables "Save as new version" with no inline message (left without saving) | p-0.png, p-history.png, mp-0.png, mp-invalid.png; s9.txt | Low | Add coverage to `rca-policy-text.ts`; label the methods; show "Built-in default" instead of the epoch; add a range error |
| RCA trigger settings | maryam | form presence | PASS | Managers now have inputs for effectiveness (600 h, 90 d lookback, 50 % reduction, 95 % coverage, 90 d review), FMEA, 5-Why and methods. This closes the E2E "UI gap" | mp-0.png | — | — |
| Knowledge base `/rca-knowledge-base` | farid, leila, maryam, sara | list, filters, search, detail, CSV | PASS | The search field now exists: `?q=lubrication` finds the entry, and `?q=zzz` shows "No entries · No entry matches these filters… · Clear filters". Filters: unit, reason code, published state. The detail (Quality 80, Unpublished, 2 of 2 actions done, source investigation (Closed), problem, root cause, recommendations) deep-links and reloads. The CSV downloads. Farid sees Publish (not clicked) | kb-0.png, kb-search-*.png, kb-detail.png | — | — |
| KB / Bad actors titles | all | heading consistency | WARN | L10. The nav says "Knowledge Base" / "Bad Actors" (Title Case) and so do the no-access pages, but the pages' h1 is "RCA knowledge base" / "Bad actors". The nav says "RCA Analysis" while the h1 is "Root cause analysis" (allowed by the glossary) | r-omid-kb.png, kb-0.png | Low | Sentence case in `navigation-items.ts`; one name for the KB |
| Bad actors `/reliability/bad-actors` | farid, leila, maryam, sara | figures, IRR, link | PASS | EXT1-Main 28.00 t, 4,200.00 USD / 2,520,000,000 IRR, 1 stop, 1 h, "Below the limit · 1 h of 8 h same-mode downtime". The window and basis are stated. "Start RCA" prefills `/rca/new?unitId=…&title=Bad actor: …` | bad-actors.png, ba-irr.png | — | — |
| Recommendations & actions, action verdict | all | policy version | WARN | L11. The action says "Effective when … at least 720 run hours" while the policy in force says 600. The action was evaluated under v1, but the page does not name the policy version | omid-case-actions-expanded.png | Low | Show "policy v1" next to the threshold |
| `/rca/new?eventId=<Shift C>` | farid | prefill, card, validation, cancel | PASS | Prefill and event card are correct (see above). "Back to the stop" and Cancel return to `/events/3ea50fb2…`. Nothing was created | new-0.png | — | — |
| `/rca/new` form | farid | validation, guard | WARN | L12. With an empty title, "Create investigation and link" is disabled with no reason and the label has no required marker. Cancel after typing a problem statement leaves without an unsaved-changes prompt. "No active template in this plant." | n-empty-title.png; s6.txt | Low | Add required markers and a "Enter a title" hint; guard dirty cancel |
| Export menu, "Copy link" | farid | feedback | WARN | L13. `navigator.clipboard.writeText` is fire-and-forget: no toast on success, and the rejection when permission is denied is uncaught (`pageerror: NotAllowedError`) | s4.txt | Low | Await, then toast success or failure (`case-export-menu.tsx:33`) |
| Event page of the closed case `/events/67cc…` | farid | RCA panel | WARN | L14. It shows "RCA completed" and "Open the linked investigation" (correct) but still offers "Create / link RCA" | ev-closedcase.png | Low | Hide or relabel it once the RCA is completed |
| Tasks `/tasks` | farid, omid, leila, maryam, sara | tasks linked to the case | WARN | M5 (WARN Medium). The plant has **0 Task Management tasks** (SQL `tasks` count = 0). The 4 evidence-collection "tasks" of the case (assignee, due date, status) live only inside the evidence items and never appear in `/tasks` or "My work → Tasks" for Omid or Leila. The glossary defines Task as a Task Management item, so the evidence "Task" columns use the term for something else. Nothing linked to the case could be checked on `/tasks` | tasks.png, case-evidence.png | Medium | Either create real tasks for evidence collection or rename the column ("Collection step") |
| Operator Omid `/rca`, `/my-queue?tab=rca-actions` | omid | menu, My RCA actions, status filter, read-only | PASS | The menu has RCA Analysis. `/rca` renders "My RCA actions" with the filter "To do (open or in progress) / Done / All" persisted in the URL (`?status=done`). His corrective action (Done, due 2026-10-19) shows under Done/All. The case opens read-only (disabled status select, disabled 5-Why inputs, no Edit). KB and Bad actors show "No access · Your roles in this plant do not include …" and are not in his menu. This fixes the E2E FAIL "Omid: No access" | omid-mq-0-1.png, omid-case-actions-expanded.png | — | — |
| `/my-queue?tab=rca-actions` | omid, leila | done actions | WARN | L16. "My work → RCA actions" has no status filter and shows only open actions ("No open RCA actions.") plus an "All RCA actions" link. Done actions are reachable only through `/rca?status=done`. This was a partial in the E2E regression and is still one click away | r-omid-myqueue.png | Low | Add the status filter or a "Done (n)" link |
| `/rca/new` for non-writers | omid, leila, sara | denial page | WARN | L15. "No access · Only reliability engineers and manager approvers open investigations." The page has **no h1** and document.title is only "Traverse Forge", while other denied pages have both | r-omid-new.png | Low | Render the denial with the page heading "New investigation" |
| Role differences | maryam / farid / leila / sara | write controls | PASS | Maryam: Reopen (reason required), Dismiss on recommendations, policy form. Farid: New investigation, Create/Link/Dismiss, KB Publish. Leila and Sara: read-only workspace and policy, KB and Bad actors visible, no New investigation | role-*.txt | — | — |
| All pages at 768×1024 | farid | layout | PASS | No page-level horizontal scroll on 15 pages. The drawer nav collapses. List, evidence, recommendations and bad-actor tables scroll inside their container | m-*.png; s8.txt | — | — |
| All pages | all | a11y, console, network, demo, uuid | PASS | 173 captures: 0 axe serious/critical, 0 failed requests, 1 console error (L13), no "demo", no uuid in text | results.jsonl | — | — |

### Additional Medium WARN

- **M7 (WARN Medium).** The Overview's "Residual risk" and "Last workflow note" quote "720 run-hour policy minimum (guide: 600 comparable hours)". That text was written at closure and is now inconsistent with the policy in force (600 h). It is historical text and is correctly kept unchanged, but nothing on the page says the policy has since changed (compare L11).

## Use cases verified

1. Browse investigations: chips as filters, 4 filters, search, URL persistence and reload, empty state.
2. Recommended tab: trigger attribution; Create / Link links; Dismiss dialog opened and cancelled.
3. Actions tab: Mine / Overdue / status / unit, Mine off, empty state.
4. New investigation from the Shift C stop: prefill, event card, evidence package, similar RCAs, empty-title validation, cancel. **Nothing created.**
5. Closed case: Overview stepper and checklist, workflow facts, reopen requires a reason (not reopened).
6. Evidence list and 4 details with files and deep links.
7. Analysis index and all 9 tool pages (read-only roles), with coded causes.
8. Recommendations & actions: action rows, evidence, baseline, verdict, realized difference.
9. Links & outcome: trigger link, evidence packages, outcome panel with separate figures, link form hidden on the closed case.
10. History: 42 entries, 3 pages.
11. Exports: JSON, evidence CSV and recommendations CSV downloaded and inspected; Copy link.
12. RCA policy: read view, version history, manager form (600 h, 95 %), invalid value, left without saving.
13. Knowledge base: list, filters, search, detail, reload, CSV.
14. Bad actors: USD/IRR, Start RCA link.
15. Operator Omid: RCA menu, My RCA actions with status filter, his done action read-only, denied pages.
16. Role differences for Maryam, Farid, Leila and Sara.
17. Definition form: edit, then Discard confirmation (discarded; verified up to confirmation).

## Data created

None. No investigation, link, dismissal, policy version, action, task or vote was saved. The definition edit was discarded through its confirmation dialog. In the role, policy, recommendation and evidence passes, a route guard aborted every API write. No write attempt was logged. Downloads were local only.

## Re-test 19 Oct

Agent: RCA · re-test after commit `dd04dd24` and deploy. Same method, with headless Chromium and a UI login per user (farid, maryam, omid, leila, sara). 137 new captures (`rt*` names in `results.jsonl`) at 1440×900, plus an 11-page pass at 768×1024. Scripts `rt1.mjs`, `rt2.mjs`, `rt3.mjs`, `rt4.mjs`, `rt5.mjs` and `rt7.mjs`, their outputs (`rt*.txt`), the `shots\rt*` screenshots and the exports (`dl-rt\`, `dl-omid\`) are in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\rca\`. In every UI pass a route guard aborted all API writes, and none was attempted.

**FIXED 16 / PARTIAL 5 / OPEN 3 / NEW 4**

The 137 captures show 0 console errors, 0 failed requests, 0 axe serious/critical violations, no "demo" text, and no uuid or snake_case in page text. At 768 px no page scrolls horizontally (11 pages checked).

### Closed investigation: read-only check (H1) and the server probe

- **UI, Farid (reliability_engineer) and Maryam (manager_approver).** Every tab now shows "Closed investigation — reopen to change". Overview, Evidence (list and all 4 details), Analysis and all 9 tools, Recommendations & actions, Links & outcome, and History offer no enabled edit control:
  - Definition: every field sits in a disabled fieldset, typing has no effect, and there is no Save/Discard bar.
  - 5-Why, fishbone, FMEA, fault tree, barrier and change inputs are disabled.
  - Action status selects are disabled.
  - Evidence detail has no Edit/Delete; only file Download remains.
  - The links form is hidden.
  - What remains: Export, the search and filter inputs, the history pager, file Download, and the diagram zoom/fit controls.
- **Reopen.** Only Maryam sees "Reopen the investigation". It stays disabled until a reason is typed, and was not used. Farid's Overview has no workflow control. Omid, Leila and Sara see only Export.
- **Server probe (Farid, one request).** `GET /v2/rcas/f58df7af…` returned 200 with `ETag W/"22"`, status Closed and rowVersion 22. `PATCH` of the same case with `If-Match: W/"22"` and body `{title: <its own current title>}` returned **409** `{"code":"CASE_CLOSED","message":"The investigation is closed; reopen it to change it"}`. SQL afterwards: `rcas.row_version` is still 22, `updated_at` is still 2026-10-18 18:47:28Z, and no `audit_log` row is newer than 3 h. **No data changed.**

### Previous findings

| # | Status | Evidence (re-test) |
|---|---|---|
| H1 closed case editable | **FIXED** | See above. UI read-only for Farid and Maryam on every tab; server 409 CASE_CLOSED (rt1-farid.txt, rt1-maryam.txt, rt2.txt "DEFINITION ctrls", shots rt-farid-*, rt2-definition.png) |
| M1 change after closure without audit | **FIXED** | History, newest entry: "Data repair · 2026-10-18 22:17 · System (data repair) · Changed: Recommendations · Reason: Data repair: the recommendations of this closed investigation were set to Completed or Cancelled…". 22:17 plant time = 18:47:28Z, the `updated_at` of the write. `audit_log` rev 22 `rca_case.repaired`, service `data_repair`. History now has 43 entries (rt2-history.txt, rt2-h-0.png) |
| M2 "Verified" badge vs verdict | **FIXED** | The preventive action shows "Not enough evidence yet"; the corrective one shows "No verification planned". No "Verified" badge (rt2-actions-expanded.png) |
| M3 two valuation views on Links | **PARTIAL** | Within the page it is now consistent: the package says "Value: Economic impact (at link time)" and the Outcome says "Economic impact … (the basis frozen in the linked evidence package)". The package basis still says "(the policy default, SME V8)", an internal reference. The same 4,200 USD is labelled "Value basis: Contribution margin" on the event page and "Value: contribution margin" on Bad actors (rt2-links-expanded.png, rt3-event-closedcase.png, rt2-ba.png) |
| M4 exports incomplete | **FIXED** | The JSON now has `analyses` (6) and `history` (43). A new "Actions (CSV)" export exists. The CSVs use display labels ("Done", "Not enough evidence yet") and the evidence CSV has observed plant/UTC time, asset and files (dl-rt\). The actions CSV "Completed (UTC)" holds the date at plant midnight (2026-10-16T20:30Z = 17 Oct) |
| M5 "Task" columns vs Task Management | **FIXED** | The evidence columns now read "Request · Requested from · Request due · Request status" (rt2-evidence.png) |
| M7 residual risk quotes 720 h | **OPEN** | Overview still quotes "720 run-hour policy minimum" with no note that policy v2 now says 600 h. This is historical text kept as written; the page needs a note (rt2-overview.png) |
| L1 non-glossary terms | **PARTIAL** | Fixed: the header reads "Triggered by: Stop from 2026-10-17 08:00", the button reads "Save investigation", Bad actors offers "Start investigation", and the event page has no "Create / link RCA". Still open: the list's Trigger column reads "Event 2026-10-17 08:00" (rt2.txt LIST) |
| L1a "Event on …" in Recommended | **FIXED** | "Stop on HDPE Extruder 1" |
| L2 legacy/Title Case statuses | **FIXED** | Status options: All statuses, Draft, In progress, Analysis, Monitoring, Closure review, Closed. "Published" is gone |
| L3 Completed vs Done | **FIXED** | Recommendations, actions and evidence requests all say "Done". The repair History reason still says "Completed" (see N4) |
| L4 no draft notice on other tabs | **FIXED (code)** | `PendingDraftNotice` was added to the workspace. It cannot be exercised on the closed case, which is now read-only |
| L5 timeline raw entity | **FIXED** | "2026-10-17 08:00 · Stop · Gearbox failure · Linked stop"; items read "No evidence linked" |
| L6 event diagram unconnected / attribution | **OPEN** | "No connections yet" and the "React Flow" attribution are still shown (also N2) |
| L7 raw failure-mode key, trend date style | **FIXED** | Links show "MECH-GEARBOX Gearbox failure · Gearbox functional failure" and "Trend window 2026-10-17 07:00 – 2026-10-17 10:00". The KB shows "Failure mode: Gearbox functional failure" (rt5.txt) |
| L8 History technical fields | **PARTIAL** | ID / Tenant ID / Investigator ids are gone, and the cause code shows its value ("ME-OIL-LIMITS — Lubricant condition limits…"). Still: 5 entries read only "Investigation details changed · Changed: Evidence", and the pager shows a total only on the last page ("1–20 · Page 1" … "41–43 of 43 · Page 3 of 3") |
| L9 policy summary | **FIXED** | The summary shows "a verdict needs at least 95.0 % state-data coverage". Methods are labelled ("5-Why or Fishbone…"). Version 1 is "Built-in default (from the start)" |
| L10 nav/h1 case | **PARTIAL** | menu = h1 = title for "Knowledge base" and "Bad actors" (sentence case). "RCA Analysis" is still Title Case in menu, h1 and title, and the case breadcrumb root is "Investigations" (rt3.txt) |
| L11 action threshold without policy version | **PARTIAL** | Now says "Thresholds frozen from the RCA policy in force when the verification was planned", but does not name v1 |
| L12 new-investigation validation and guard | **FIXED** | "Title* required", the hint "Enter a title to create the investigation." (aria-describedby), and Cancel when dirty asks "You have unsaved changes. Leave this page and discard them?" |
| L13 Copy link | **FIXED** | When the clipboard is denied, a toast says "Could not copy the link · Your browser did not allow copying. Copy it from here: …". No pageerror |
| L14 "Create / link RCA" on a completed event | **FIXED** | The event page shows only "RCA completed" and "Open the linked investigation" |
| L15 `/rca/new` denial without h1 | **FIXED** | h1 and title are "New investigation", with "No access · Only reliability engineers and manager approvers open investigations." |
| L16 My work → RCA actions has no status filter | **OPEN** | Still "No open RCA actions." and "All RCA actions". The filter exists only on `/rca` |

### New findings

| # | Page / route | Role | Result | Finding | Evidence | Severity | Suggested fix |
|---|---|---|---|---|---|---|---|
| N1 | Case header, Links & outcome, Actions, Export `/rca/:id*` | omid (operator) | FAIL | **Operators still see money in RCA**, contrary to DECISIONS 2026-10-19 "No money for operators". The approved-impact block is gated (it shows "Availability: 28.00 t" without a value), but these are not: <br>• the case header "Approved loss 28.00 t / 4,200.00 USD" on every tab <br>• the Outcome "Claimed avoided loss 4,200.00 USD (1 action)" <br>• the action meta "claimed 4,200.00 USD" <br>• Omid's JSON export (claimedAvoidedLoss 4200, approved values USD 4200 / IRR 2,520,000,000) <br>• the Actions CSV "Claimed avoided loss 4200 USD" | rt-role-omid.txt lines 62, 320, 504; rt4.txt; dl-omid\ | Medium | Gate with `canViewMoney` in `src/features/rca/case/case-trace.tsx` (ApprovedLossText), the claimed-avoided figure in the Outcome panel, `src/features/rca/actions/action-meta.tsx`, and `src/features/rca/model/case-export.ts` (drop value fields for operators) |
| N2 | Event diagram `/rca/:id/analysis/event-diagram` | farid, maryam (closed) | WARN | The closed, read-only case still shows the edit instruction "No connections yet: use "Add connection", or drag from an event's bottom handle to another event." and React Flow's "toggle interactivity" control | rt1-farid.txt | Low | Hide the hint and interactivity control when `readOnly` |
| N3 | Bad actors `/reliability/bad-actors` | farid, leila, sara | WARN | Internal references show in user text: "(CA8)" in the subtitle and "the CA8 cumulative same-mode downtime rule". The basis sentence starts lowercase ("…not included. approved plan lines of approved periods…") | rt2.txt BA | Low | Remove the spec ids and capitalise the basis (`src/features/rca/bad-actors/`) |
| N4 | History repair entry | all | WARN | Title "Data repair" and the reason repeats it ("Reason: Data repair: …"). It says recommendations were "set to Completed or Cancelled" while the UI labels that state "Done" | rt2-history.txt | Low | Drop the "Data repair:" prefix from the reason; use the display label "Done" |

### Use cases re-verified

1. The closed case is read-only on every tab and tool for Farid and Maryam; Reopen appears only for Maryam (reason required, not used).
2. Server refusal: one PATCH with the current If-Match returned 409 CASE_CLOSED, and SQL confirms no change.
3. The data-repair History entry: System actor, plant time, reason, changed field.
4. Exports: JSON (with analyses and history), and evidence, recommendations and actions CSVs. Copy link fallback.
5. List, Recommended and Actions tabs; status options; policy summary and version history; KB list and detail; Bad actors.
6. New investigation: required marker, hint and dirty-cancel guard (left without creating).
7. Role pass for Omid, Leila and Sara: read-only workspace; Omid's denied pages have an h1; My RCA actions status filter.
8. 768×1024 pass on 11 pages.

### Data created (re-test)

None. The UI passes aborted every write. One deliberate PATCH was refused with 409 by the server, and SQL confirmed the case is unchanged (row_version 22, updated_at 2026-10-18 18:47:28Z, no new audit row). Downloads were local only.

## Round 3 re-test (19 Oct 2026)

Run: 19 Oct 2026, about 17:05–17:45 Tehran, after the 17:18 redeploy of the round-3 fixes. Headless Chromium, UI login for farid, maryam, reza, leila, sara and omid, at 1440×900 (all tabs, all 9 analysis tools, the 4 evidence details, Bad actors, Knowledge base, the list and its tabs, New investigation) plus 768×1024 for farid and omid. A browser guard aborted every write; none was attempted. Captures are in `C:\Users\Admin\AppData\Local\Temp\claude\d--HMI-Project-Usama-ProAct\8340f887-b72f-4b11-b2f2-ae7460ebd8b3\scratchpad\qa\r3dr\` (`r1-*`, `r2-*`, `e1-*`, `e2.json`, `shots\`, `dl\`).

Result on every page: **0 console errors, 0 failed requests, 0 axe serious/critical issues, no horizontal scroll at 768 px, no raw keys or uuids, no "demo" text.**

### Closed investigation f58df7af… is read-only

- **UI:** farid and maryam see "Closed investigation — reopen to change" on every tab. All definition fields, the 5-Why, fishbone and FMEA inputs and the action status selects are disabled (checked with `:disabled`, including inputs inside disabled fieldsets). Evidence has search only, Links hides the form ("reopen it to add a link"), and the event diagram shows zoom / fit only. Only maryam has "Reopen the investigation", and it stays disabled without a reason (not used). leila, sara and omid see Export only.
- **Server, reza (manager approver), one request:** `GET` returned 200, `ETag W/"22"`, status Closed. `PATCH` with that If-Match and the case's own title returned **409 `CASE_CLOSED`** ("The investigation is closed; reopen it to change it"). A second `GET` still returned `W/"22"`. Nothing changed.

### Verified fixed in round 3

- **Operator money (N1):** omid's header reads "Approved loss 28.00 t" (no amount). The Outcome has no "Claimed avoided loss" figure, the action has no "claimed …", and there is no "Value basis" or "Est. cost". His JSON export has no amounts (only the field names "Claimed avoided loss / currency" in one history entry), and his Actions CSV has no claim columns. Bad actors is refused for him ("No access").
- **M7:** the Overview adds "The actions' thresholds were frozen from RCA policy v1 (at least 720 run hours after an action). The current policy v2 asks for at least 600 run hours; it applies to new baselines."
- **L1:** the list Trigger column reads "Stop 2026-10-17 08:00", and Recommended says "Stops where an RCA trigger fired…".
- **L6 / N2:** the closed case's event diagram has no "Add connection" hint and no interactivity toggle.
- **L8:** History reads "1–20 of 43 · Page 1 of 3" on the first page, and old entries say "Recommendations (which item changed was not recorded)".
- **L11:** "Thresholds frozen from RCA policy v1 when the verification was planned."
- **L16:** My work › RCA actions has a Status filter ("To do (open or in progress)").
- **N3:** Bad actors has no "(CA8)" and its basis is a capitalised sentence ("Value basis: Contribution margin; 5 periods not included: No approved plan covers these periods.").
- **N4:** the repair reason reads "Recommendations completed after the investigation closed: each recommendation was set to Done or Cancelled…", with no "Data repair:" prefix.
- **Event page vs Outcome vs Bad actors** all say "Value basis: Contribution margin" for the 4,200.00 USD.
- **Dialogs:** Dismiss recommendation (reason required, cancelled) and New investigation (h1, required title, Cancel goes back to `/rca`). omid gets "No access · Only reliability engineers and manager approvers open investigations."
- **Exports** (JSON, Evidence CSV, Recommendations CSV, Actions CSV) downloaded for all 6 personas.

### Remaining problems

| # | Page | Persona | What's wrong | Expected | Severity |
|---|---|---|---|---|---|
| R3-1 | Overview › Definition; Analysis › Event diagram; Recommendations & actions | all | Course / test wording in the live investigation: Problem statement "**Training** extruder stopped from 08:00 to 09:00…"; event-diagram item "…oil temperature trend rising before the trip (**fictional**)"; action evidence "…within limits (**fictional**)". The residual-risk text also cites "(**guide**: 600 comparable hours)". The case is closed, so users cannot correct it. | A one-off text repair, like `rewrite-finance-texts.ts` for finance: plain production wording, no "training" / "fictional" / "guide". | Medium |
| R3-2 | Links & outcome | farid, maryam, reza, leila, sara | The same 4,200.00 USD appears under two bases on one page: the evidence package "Value basis: Economic impact (lost sales + incremental costs) (at link time)", and the Outcome "Value basis: Contribution margin". This follows the decision (frozen packages keep their basis), but a reader cannot tell why the same amount has two bases. It also reads "USD: 4,200.00 USD", with the currency twice. | Explain the difference in one line under the package (for example "valued when linked; the outcome uses the view frozen at approval"), and drop the repeated currency. | Low (M3 carry-over) |
| R3-3 | Overview (team charter) | omid | The typed charter text "…approved availability loss 28 t, USD 4,200…" shows money to the operator. It is free text, so the server rule cannot remove it. | Accept as free text, or keep amounts out of charter text. | Low |
| R3-4 | Recommended tab | farid, maryam | The table heading reads "Open RCA recommendations" and the first column "Event", while the rows say "Stop on HDPE Extruder 1" and the tab says "Recommended investigations". | "Recommended investigations" / column "Stop". | Low |
| R3-5 | Overview › Workflow | farid, leila, sara | "SuperAdmin may approve their own investigation; other approvers must be independent." is shown to every role. | Show the SuperAdmin sentence to SuperAdmin only, as on the approval pages. | Low |
| R3-6 | History | all | Old-value words are lowercase and technical: "Status: none → Open", "Statement (characters): none → 79 characters". | "Status: — → Open", "Statement: added (79 characters)". | Low |
| R3-7 | Exports | all | The investigation CSVs have no UTF-8 BOM, unlike the Event Hub and period-summary CSVs. Non-ASCII text (—, “ ”) will break in Excel once it appears. | The same BOM as the other CSV exports. | Low |
| R3-8 | RCA trigger settings | all | "Minor: … (team ≥ 0)", a meaningless limit. "baseline counted from history…" on the action starts in lowercase. | Leave out "team ≥ 0"; use sentence case. | Low |
| R3-9 | Menu / h1 | all | "RCA Analysis" is still Title Case (left to the navigation owner, per the decision). | "RCA analysis" if the owner agrees. | Low (owner) |

### Data created in round 3

None. The browser guard aborted every write, and none was attempted. The one deliberate server PATCH (reza) was refused with 409, and the ETag is still `W/"22"`. Downloads are local only.
