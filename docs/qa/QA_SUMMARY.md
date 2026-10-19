# QA audit summary — Marun / HDPE plant (19 Oct 2026)

Six UI audits, each logging in through the real login page as the plant's personas, at 1440 px and 768 px, using headless Playwright with axe. Detailed reports: [QA_SHELL](QA_SHELL.md), [QA_DOWNTIME](QA_DOWNTIME.md), [QA_PLANNING](QA_PLANNING.md), [QA_PLA_ANALYTICS](QA_PLA_ANALYTICS.md), [QA_RCA](QA_RCA.md), [QA_MASTERDATA](QA_MASTERDATA.md).

**What is correct everywhere:**
- Every 17 Oct figure matches across Downtime, PLA, Planning, the dashboard, Reports and the exports, and the seeded setup matches the guide.
- No console errors and no failed requests other than the bugs listed below.
- No "demo" text or raw ids on screen, and no horizontal scroll at 768 px.
- Menus and direct URLs agree for all 14 accounts, and Integration is shown only to SuperAdmin.

| Area | High | Medium | Low |
|---|---|---|---|
| Shell / admin / approvals | 1 | 9 | 15 |
| Downtime | 1 | 8 | ~20 |
| Planning / period accounting | 1 | 8 | ~22 |
| PLA analytics / reports | 0 | 6 (+2 questions) | ~13 |
| RCA | 1 | 4 (+2 warnings) | 17 |
| Master data / finance / integration | 0 | 9 | 27 |

## Priority 1 — integrity and broken features
1. **A closed investigation can still be edited** (RCA H1): tools, definition, evidence and action status, both in the UI and probably on the server. Closed cases must be read-only on the server and in the UI.
2. **A decided restatement posting stays editable** (Planning): "Save posting" is still offered after the decision, the row has been overwritten once, and the page doesn't say who decided. Once decided, the posting should be read-only.
3. **Previous-period comparison is broken** (Downtime F1): the request is sent without `views` and gets a 422.
4. **Work items dead-end for periods that no plan covers** (Planning P-0): 18–19 Oct appear in My work and month close with no link and no explanation, so the month can't be closed from the UI.
5. **Legacy role mapping gives `production_engineer` to approvers** (Shell H1): Kamran, Neda, Arman, Darya, Bahram, Sara and Mina can prepare work and verify coding (owner decision Q1).
6. **Repairs leave no audit trail:** data-repair migrations change records without writing to the audit trail or to the case history (RCA M1, the 18:47Z recommendation repair).

## Priority 2 — wrong or misleading information
- **Change proposals:**
  - Before/after dumps about 40 internal fields with no units and shows "residual" (P-1).
  - A value-only restatement looks like no change, because USD 5,040 → 5,250 isn't shown anywhere (P-2).
- **RCA:**
  - The action badge says "Verified" while the verdict is "not enough evidence" (RCA M2).
  - Links & outcome shows two different value bases, and "SME V8" text is visible (RCA M3).
- **PLA:**
  - The loss events list shows "—" for lost quantity (PLA M2).
  - Quality drill-downs open "No loss events" (PLA M3).
  - The "Not coded" group mixes quality dispositions with the uncoded stop.
- **Reports:** contradictory labels ("Approved only" next to "Provisional"), coverage 43 % vs 86 % on the dashboard, and exports disabled with only a terse hint (Shell M4).
- **Downtime:** the summary ignores the schedule-class filter (F2, owner decision Q4).
- **Dates and windows:**
  - Plant-wide default versions show "since 1970-01-01" (Master data M1).
  - Unit state coverage shows nothing when the window starts before the mapping (M3).
  - One production day is labelled 17–18 Oct, and the date inputs use the browser format instead of the plant format (PLA M1).
- **Raw keys and internal notes shown on screen:**
  - Codes: `GEARBOX_FAILURE`, `TRIP_ALARM`, `five_why`, `pi_output_ef`, `seq_boot`.
  - Raw seconds in the setup readiness checks.
  - Internal notes such as "D13 default…", "SME D12" and "Seeded on first use…".
- **"Author: Another user" on finance policies** (Master data M2). The header badge shows the legacy role ("Analyst") instead of plant roles.

## Priority 3 — consistency and usability
- **Page names:**
  - Menu and page titles differ in capitalisation and wording (Master Data vs Master data, Admin Panel, Month Close, Source Status Rules, Knowledge Base, Bad Actors).
  - A breadcrumb repeats a level.
  - The period page's h1 doesn't name the shift.
- **Glossary wording:**
  - "Triggered by: Downtime", "Event on…" should say Stop.
  - "Save case", "Start RCA" should say investigation.
  - "1 stop(s)", "1 groups".
- **Units and number formats:** "28.00t" and "4,200.00USD" with no space, FX shown without a thousands separator.
- **Forms:**
  - Required markers and the unsaved-changes guard are missing on several forms: plan, version, profile, disposition, adjustment, calendar, new investigation and new code.
  - Some disabled buttons give no reason.
  - The event form has no end-after-start check.
  - Create new version doesn't ask for a reason or confirmation.
- **Dead or misleading links:**
  - The operator sees links that lead to "No access": Review & close, breadcrumbs, Reports & exports.
  - The Master data refusal page is bare, with no h1 or title.
  - The dashboard "Pending approvals" tile appears only for managers, so Kamran doesn't get it.
  - `/approvals/<bad>` shows a generic error.
- **Audit log:** an export is logged as `CREATE Exports "unknown"`, and a bulk-code preview is logged as a create.
- **Exports:** the CSV has no BOM, raw values, and no reason codes on loss lines.
- **Accessibility:**
  - The reason-code tree has a `listitem` error.
  - The split-dialog slider has no name.
  - The Bad actors table can't be scrolled by keyboard at 768 px.
  - The trends tooltip fails colour contrast.

## Owner decisions needed
- **Q1** Legacy roles: should each persona hold only the role the guide gives them (recommended), or keep the legacy mapping?
- **Q2** Operators and money: should the operator see Loss Valuation money and the PLA CSV export? Recommended: no money for operators.
- **Q3** Event editing by the production accountant (Sara): should Sara keep code / split / merge? Recommended: read-only coding for the accountant.
- **Q4** Downtime summary: should it follow every filter, including schedule class? Recommended: yes, with the filter shown in the scope line.
- **Q5** Product and unit names: drop "training", as for the organization and plant?
- **Q6** 18–31 Oct (rest of Mehr): leave unplanned, and show "No approved plan covers this period" with a link to Plans (recommended), or seed an approved plan?
