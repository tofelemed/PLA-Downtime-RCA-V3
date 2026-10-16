# Operating the configured application

Begin each shift by checking the selected plant and unit, the plant-local date and the live/source status. Read the dashboard as a summary of available server results. An unavailable value, missing source or provisional result is a condition to investigate, not a zero production or zero loss result.

Operators review current events, close completed stops, choose the appropriate leaf reason and distinguish planned, unplanned and external causes. Production staff review actuals coverage and the correct product for each period. Reliability staff validate failure details and repair evidence. Quality staff decide dispositions. Production accounting reconciles the period and records justified bridges. Independent reviewers approve and certify. Finance owns valuation and financial close decisions.

Use My queue for your due and overdue work, month-close prerequisite counts for the total blocked population and notifications for in-app follow-up. Month-close sections show bounded samples of up to 50 records. Their count links select those sections; they do not provide a complete paginated list. My queue contains recent assigned work and is not the full month. Resolve the relevant records through their plan and period workflows and confirm that the authoritative totals reach the required state.

# Daily procedure

1. Confirm the header plant and unit, time zone and reporting window. Check that the currently effective plan, calendar and profile are the intended versions.

2. Inspect source connection and job health. Check the last observation, counters, quality, lag and quarantine. Compare a known source event or sample with its canonical record. Escalate missing or stale feeds to the source owner.

3. Review open, uncoded and possible duplicate events. Correct coding through the application. Use split and merge only after previewing the resulting boundaries. Preserve source identity and evidence.

4. Review period Actuals. Resolve source conflicts and incomplete coverage. Record required quality dispositions or actuals adjustments with evidence and the correct approval. Check units and measurement boundary.

5. Recompute and wait for completion. Review both ledgers independently. Explain candidate lines, save the reconciliation draft, check residual and evidence, then submit. The reviewer uses Review and History to confirm the intended revision and independence.

6. Certify the production day when every required shift is approved. Check data holds, overdue work and change proposals. Do not certify incomplete work merely to clear the queue.

7. Review RCA recommendations, due actions, evidence and verification windows. A completed task still needs effectiveness evaluation where planned. Close a case only through independent review.

8. Generate approved reports when needed, wait for export completion and download through the authorized link. Check the report window, revision, units and currency before distributing it.

# Weekly and month end procedure

Review repeated causes, asset bad actors, source coverage, unreconciled periods, rejected work and overdue RCA actions. Confirm future shift instances, rate coverage and product campaigns are available. Check expiring source credentials and certificates through the site process. Test representative integration mappings after upstream schema changes.

At month end, use Overview to identify the close state, Periods to resolve missing approvals, Days to resolve missing certifications, Proposals to decide unresolved changes and History to review prior actions. Management closes quantities only when the gates pass. A separate finance approver signs off and locks. Preserve the resulting approved reports and posting context according to site policy.

For a late correction, create the supported proposal with reason and evidence. Follow the decision, revision, reapproval and posting workflow. A locked month must not be corrected through direct SQL updates. The operational period and financial posting date serve different purposes.

# Persona acceptance matrix

The following checks are commissioning procedures. Execute them with separate named users and realistic representative records in a safe test environment. A successful login alone does not prove a persona can complete its work.

- System administrator (SuperAdmin): create organizations and plants, manage application-wide branding, provision users, assign bounded scopes and review audit history. Verify that grants are no broader than intended and that global administration does not bypass workflow independence.
- Organization administrator (OrgAdmin): open Admin and create plants within the assigned organization. Verify that organization creation/deletion, plant deletion and application-wide branding are unavailable, and that another organization's plants cannot be created or administered. Manage permitted users and scopes within the organization and review authorized audit history.
- Plant administrator: manage permitted users and settings in the assigned plant. Verify denial when requesting another unauthorized plant.
- Master data administrator: create units, assets, products, codes, calendars and profile drafts within the permitted scope. Have the required independent role approve the versioned records.
- Integration administrator: configure a connection, test it, map representative data, inspect quarantine, dry-run and replay a corrected record, and pause/resume ingestion. Verify credentials are not returned in readback.
- Operator: create and code an event, close an actual stop and record the permitted quality information. Verify read-only or unavailable controls for actions outside the role.
- Production engineer: prepare a plan or reconciliation as permitted, inspect actuals, review stop coding and submit complete work. Verify the correct unit and profile context and stale-edit behavior.
- Production accountant: reconcile both ledgers separately, add a permitted bridge with evidence, manage source authority/status proposals and process a late correction. Verify no self-approval of authored work.
- Quality approver: review a lot disposition, independently approve or reject it and confirm the resulting good, scrap, downgrade and rework quantities stay distinct.
- Metrology approver: review an uncertainty budget independently. Confirm adoption as an accounting tolerance is a separate authorized operation.
- Finance maintainer: draft valuation policy, rates, FX and applicable demand status. Verify an unapproved draft does not become the authoritative value.
- Finance approver: independently approve finance records, review missing or provisional values, sign off and lock a month, and decide restatement posting where applicable.
- Manager approver: approve eligible periods, certify days, close quantities and independently approve RCA closure. Verify author, submitter and investigation-participant conflicts are refused.
- Reliability engineer: validate failure details, link events to RCA, complete the required method, add actions and verify effectiveness. Confirm approved historical loss, claimed benefit and realized outcome remain separate.
- Viewer: open authorized dashboards, lists, detail pages and reports. Verify business write controls are absent or disabled and direct writes are refused by the API.
- Restricted-unit user: repeat read and write tests for the assigned unit and an unassigned unit. Verify lists, details, exports and real-time updates do not leak the other unit's records.

# UI and query acceptance

For every configured module, open its list, detail, create and edit states where present. Exercise each filter individually and in a meaningful combination. Where filters use the URL or server requests, confirm those parameters preserve the selected plant, units, dates and query context. For local filters, such as the Failure dictionary list selector, check the visible results and documented local state instead. Check each summary's stated scope: Audit Activity uses the selected period, while search, action and record filters narrow the entries list and export; Tasks Summary uses search, priority and My tasks, while Status and Overdue only narrow the task list. Change pages or cursors and check that records are neither duplicated nor silently omitted. Reset filters and verify the baseline returns.

Test direct deep links, browser Back and Forward, refresh, return-to-list links and a nonexistent record. Check that a link from an event or accounting line opens the correct related detail. An unknown record should produce a useful state, not an empty pane that appears successful.

On editable pages test required fields, invalid dates, empty optional values, numeric boundaries, selectors and conditional advanced fields. Collapse and reopen a section to confirm values remain. Save, reload and compare server readback. Make a conflicting edit from another session and verify the original draft is retained for review rather than overwriting newer data.

At desktop and narrow widths, inspect text, controls, tables, dialogs, focus order and error messages. Local table scrolling can be appropriate for wide data, but the page should not expand beyond the viewport. Check keyboard activation, visible focus and accessible labels. A screenshot alone does not establish complete screen-reader accessibility.

Record each test with persona, route, preconditions, input, expected response, actual response, correlation identifier, resulting record version and evidence location. Preserve the failed attempt as well as the repair check. Do not count reruns as additional independent tests.

# Troubleshooting by symptom

## Sign in or session cannot load

Check API health and network reachability. A generic credential failure can mean an invalid or inactive account; do not disclose which credential was wrong. The session recovery screen preserves a saved sign-in during a transient service failure and offers Retry session or Sign out. Retry after checking availability. If a session remains unusable, capture the time and correlation identifier and inspect the backend request path. Do not clear permissions or bypass authentication to make the page appear.

## A menu item or plant is missing

Check the user's effective scoped roles, active status, selected plant and applicable feature flag. Compare with the server role set for the operation. A legacy role label alone does not describe every effective grant. Organization/system roles can provide access even when no plant-role row is listed on the user detail screen.

## The event or signal is missing

Check connection activation, diagnostics, job/subscription state, topic or source selection, raw observation arrival, identity mapping, timestamp, quality and quarantine. If raw data exists but the canonical record does not, investigate the mapping or normalization failure. If raw data never arrived, investigate the source and transport. A broker connection test does not prove data ingestion.

## The period has no actuals or capacity

Check the operational window, product slice, approved rate coverage, published calendar and source authority. Inspect observed coverage and quality. A missing profile, wrong signal boundary or unapproved source status must be corrected at its source. Do not enter zero output unless supported by evidence.

## Reconciliation cannot be submitted or approved

Read every gate message. Check residual, evidence, impossible claims, required quality decisions, stale calculations and source conflicts. Confirm the chosen revision is current. Then check the reviewer's role and independence. Increasing tolerance or using an administrator account is not an appropriate substitute for resolving the actual gate.

## A save conflicts

Read the newer version and compare it with the retained draft. Rebase or deliberately reapply the intended changes. Do not repeatedly submit a stale If-Match value. If a request timed out after submission, inspect the record or job before creating another command.

## Money is unavailable or provisional

Check approved policy, valuation-rate coverage, FX dates, currency and demand status. Missing currency values are deliberately null. The display toggle cannot create a missing exchange rate. A provisional rate must remain labelled until the final finance decision and resulting recalculation or proposal are complete.

## Month close is blocked

Use the authoritative prerequisite counts and the bounded samples to identify work. Resolve unapproved periods, uncertified days and open proposals through the relevant plan and period workflows; the month-close screen does not page through every blocked record. Confirm management and finance duties are independent. For an already locked month, use the correction/restatement process.

## RCA cannot move to the next state

Read investigation or closure readiness. Complete root cause, required method evidence and scores, action evidence, planned verification and residual-risk disposition. Confirm the closure reviewer has never been an investigator. An insufficient-evidence verdict is not the same as an unverified action; the reviewer must understand the recorded outcome.

## Export has no downloadable file

Check the asynchronous export job, worker health, shared private storage, retention expiry and current user authorization. The request can succeed before the file exists. Verify font configuration if a PDF contains missing Persian glyphs. Do not expose the export directory publicly to bypass download checks.

# Health logs and support evidence

Use docker compose ps for service state and docker compose logs --since with a bounded time window for the relevant service. API health is /api/health. Worker probes are /health/live and /health/ready on its internal port. Check database connection saturation, slow queries, migrations and job errors when service symptoms persist.

Capture the exact route, selected plant and unit, local and UTC time, record ID, action, HTTP status and correlation ID. Include a redacted screenshot and the minimum reproducible input. Do not include access tokens, refresh tokens, database passwords, connector credentials or complete unredacted environment files.

The frontend uses bounded session startup and preserves valid credentials through an infrastructure failure. This improves recovery; it does not prove the underlying network or service cannot stall. An intermittent error that does not reproduce must remain identified as unattributed until its cause is established.

# Backup restore and release procedure

Back up PostgreSQL using a supported consistent backup method and preserve the matching deployment configuration and encryption keys. Include uploads and any export files required by the site's retention policy. Record backup time, source database, application revision and migration state. Protect the backup as sensitive plant information.

For a containerized custom-format database backup, write the dump inside the intended database container and then copy that file to protected backup storage. This avoids corrupting binary output through an unsuitable shell text redirection. Use the actual service/container and database names; the local HDPE names are examples.

```text
docker compose exec postgres pg_dump -U <database-user> -d <database-name> -Fc -f /tmp/site-backup.dump
docker compose cp postgres:/tmp/site-backup.dump <protected-backup-path>
```

Restore into a separately named database and isolated application stack. Before starting the restored worker, disable copied external connections and schedules through a controlled procedure. Keep the clone from consuming or duplicating production subscriptions. Verify hierarchy, users/scopes, a recent approved period, month-close state, representative uploaded evidence and decryption of a test connector credential without displaying the secret.

For a release, record the candidate commit and image identifiers, review migrations, run the relevant automated checks and verify representative persona workflows on the isolated restore. Back up the live data, then deploy the approved image. Run read-only acceptance checks immediately after deployment. A rollback must consider schema compatibility; an older image is not automatically compatible with a newer database migration.

# HDPE validation evidence

The HDPE seed and earlier end-to-end campaign are recorded in docs/HDPE_E2E_REPORT.md. This follow-up used a fresh evidence directory and kept live business data separate from mutation tests. The live plant remained on ports 8070 and 4004. Structural workflow tests used a restored database named proact_ui_followup_test with frontend 8071 and API 4006. Backend integration tests used proact_hdpe_test. Copied source connections were disabled before the isolated worker started.

The final full frontend regression run passed 981 tests across 161 files. The complete frontend lint run had zero errors and 228 existing warnings. Application, tooling and E2E TypeScript checks passed after the final changes. The combined Linux frontend image build passed.

Backend unit and accounting-math checks passed 2540 tests across 220 suites. The full integration campaign ran 173 suites and 990 tests: 166 suites and 962 tests passed initially, with seven failed suites and 28 failed tests. The exact seven-suite diagnostic rerun passed all 35 tests in those suites. The latest result per suite is therefore 173 of 173 suites and 990 of 990 tests passing. This is not described as one fresh all-green full run. Initial HTTP service and connection-reset failures remain preserved; the quiet diagnostic rerun did not reproduce them and their root cause remains unproven.

The browser baseline passed 121 checks covering 62 route checks, six responsive checks, all 52 named personas and a locked-month refusal. Four session-recovery scenarios and six targeted navigation/unit checks also passed. Those checks preceded the later structural changes and are reported as their own campaign, not merged into a single fictional run.

The period-accounting pilot reached 26 unique affected checks passing across their latest executions. The combined structural campaign exercised 45 checks; subsequent repair verification and continuation established passing latest results for those checks, with four additional period-workspace checks. The original failures included a genuine duplicate-history Back-button defect, test locators changed by the new disclosures and transient session/transport failures. The product history defect was repaired with a focused regression; locator corrections did not relax the business assertions.

Final RCA visual acceptance covered nine populated desktop/mobile states with zero page errors, API HTTP errors or business writes, and document width matching 390 or 1440 pixels. Month-close and MQTT final captures separately verify section navigation, capped count samples, local draft retention and narrow-screen layout. These checks do not imply every possible record and assistive-technology state was tested.

The repairs include dependency remediation, bounded session recovery, legacy reversed-plan interval validation, detail-navigation corrections, clearer plan units, period sectioning and draft protection, month-close sections and history navigation, a separate RCA definition page, grouped RCA action evidence, grouped MQTT profile sections and clearer user-access wording. The page task breakdown records which pages were retained and which future design changes need additional evidence.

The final OrgAdmin correction aligns the administration-page gate with the server's existing same-organization plant-creation permission. Organization creation, deletion and application-wide branding remain restricted. A focused regression run passed 69 tests across three files, with clean targeted lint and application typecheck. Audit Activity and Tasks Summary now state which filters apply to their counts.

The final local frontend image is proact-frontend:hdpe-structural-final-20261016, built from product revision 2f385d2. It was deployed on port 8070 after six final month-close browser checks passed on the isolated stack. Eight additional read-only captures checked the summary notes, user-access wording, OrgAdmin allowed and denied screens, and the scrolled mobile proposal Reason column. The column is readable within contained horizontal scrolling. Live acceptance then passed for the hierarchy, scoped permissions, accounting, locked/current months and finite MQTT signal totals. No live business record was changed by these release checks.

The documentation inventory covers all 95 route declarations, including the development-only route, through 95 page groups and 2080 field/display entries. Repeated rows are described by their field definitions once. Static route and control reconciliation supports documentation coverage; it does not prove that every runtime combination or dynamic dataset was tested.

# Known limits and remaining decisions

The current HDPE dataset is synthetic. Actual site acceptance still requires the plant's approved rates, calendars, measurement boundaries, dictionaries, role matrix, tolerances, finance values and real source systems. PI workflow testing against a simulator does not certify an actual PI installation. No live SQL Server was supplied for the retained maintenance scripts; dependency and parameter-binding checks are not a connectivity test.

Production dependency audits were cleared in both npm projects, and backend development dependencies also audited clean. A frontend development-only braces advisory remained through the existing Tailwind dependency chain. No unrelated major tooling migration was forced. Lint warnings remain as technical debt even though lint errors are zero.

The test campaign does not establish complete screen-reader accessibility, every keyboard path, every empty/error state or every possible dynamic record. The shared narrow-screen header remains dense. A rule-builder condition that accepts raw identifier lists is a documented usability opportunity. These are tracked with the source-backed page task breakdown rather than disguised as completed redesigns.

In-app notifications are implemented; do not assume email, SMS, CMMS delivery or arbitrary protocol adapters are available merely because a related business term appears in configuration. Check the actual route, feature flag, contract and source adapter before promising an integration. Persian display does not imply a complete right-to-left layout.

# Evidence and maintenance index

- docs/HDPE_E2E_REPORT.md records the original seed and campaign.
- docs/HDPE_FOLLOWUP_REPORT.md records the follow-up repairs and verification.
- docs/FRONTEND_RESTRUCTURING_PLAN.md and docs/FRONTEND_RESTRUCTURING_PROGRESS.md record the approved page decomposition and execution.
- docs/HDPE_PAGE_TASK_BREAKDOWN.md maps route families to retained or changed pages, ownership, dependencies and acceptance criteria.
- docs/HDPE_DETAIL_PAGE_REVIEW.md records the visual review and its coverage limits.
- test-results/hdpe-followup contains raw logs, JSON reports, diagnostics and captured images. These are engineering evidence, not additional user manuals.
- docs/manuals/source contains the structured page/field inventory and prose sources used to build this document set. Regenerate and reverify the manuals when routes, fields or business rules change.
