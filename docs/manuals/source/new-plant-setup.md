# How to use this guide

Follow the numbered stages in order. A stage is complete only when its verification result is satisfied. The field procedures later in this document give the individual input, default, option, validation and behavior details for the configuration and commissioning screens. Fields that are calculated or returned by the server are identified as read only. Optional fields still require an explicit decision to leave them blank or supply a value.

Two setup paths are supported. For a fresh installation, start with Stage 1. For an additional plant in an existing working installation, preserve the existing infrastructure and start with Stage 4 using an authorized administrator. Do not run demonstration seeders or delete existing organizations to add a real plant.

The HDPE example uses an HDPE organization and an HDPE plant because the application models company ownership and operating plant as separate levels. Under the plant create unit100 containing Extruder1, and unit200 containing Extruder2. The same display name at organization and plant level does not merge those records.

# Stage 1 Prepare the site workbook and responsibilities

Assign named owners for system administration, plant management, production accounting, operations, reliability, quality, metrology, finance and integration. Assign at least two independent people wherever authoring and approval must be separated. Record who can approve a period, certify a day, close quantities, approve finance settings, lock a month and approve an RCA closure. Do not use a shared administrator account for the operating workflow.

Collect the company and plant names and codes, unit and asset hierarchy, product grades and units of measure. Obtain the approved IANA time zone, operational day start, reporting calendar, week start, shifts, crew rotation, holidays and maintenance exclusions. Confirm whether the plant uses a financial calendar different from the displayed calendar.

For every unit and grade collect the sustainable rate, planning rate, effective dates and approval evidence. Collect grade-transition standards including applicable catalyst family and operating mode. Identify the primary measurement boundary, signal names, units, quality semantics, timestamp meaning, counter reset behavior and allowed fallback sources. Obtain inventory or lag evidence before authorizing a substitute measurement from another boundary.

Collect reason and failure dictionaries, code mappings, state mappings, micro-stop criteria, standby equipment and tests, work-order repair timestamps, critical assets and RCA thresholds. Finance supplies the valuation basis, unit rates, FX source, effective dates, provisional-rate policy, demand assumptions and materiality rules. Metrology supplies approved uncertainty evidence before any nonzero reconciliation tolerance is adopted.

Verification: the responsible owner has signed off each required source value. Unknown values remain recorded as unresolved setup dependencies. Do not copy a synthetic example merely to remove a validation warning.

# Stage 2 Install the application stack

Use a host with Docker Engine and the Compose plugin, network access to the required image and package registries, persistent storage and the intended plant network routes. The repository Dockerfiles build with Node 24. For source development use the lockfiles and the repository's npm commands; the documented legacy peer-resolution option is required by the existing dependency tree.

Obtain the reviewed repository revision and retain its commit identifier. From the repository root copy .env.example to .env. Edit the new file with site-specific values. Never paste the actual file into support messages or documentation. The Compose and runtime variable reference appears later in this guide. Root .env values are passed to containers only where Compose explicitly maps them. Optional runtime settings such as DB_POOL_MAX and PDF font paths need an environment entry in the appropriate service or deployment override; adding their names to root .env alone has no effect.

Set POSTGRES_PASSWORD to a strong unique database secret. Set JWT_SECRET and JWT_REFRESH_SECRET to separate long random secrets. Keep AUTH_ALLOW_PUBLIC_REGISTRATION=false and DB_RLS_TENANT_BINDING=true. Configure a stable credential encryption key or named key ring and keep its recovery copy with controlled access. Changing a key without the supported rotation process can make stored connector credentials unreadable.

Choose unused host ports. The default frontend is 8070, API 4004 and bundled PostgreSQL 5433. Container-to-container database traffic uses postgres:5432; localhost inside the backend container is the backend itself. The current HDPE machine's custom database host is not a universal installation value.

Set the actual PI proxy endpoint if PI is used. Configure CONNECTOR_EGRESS_ALLOWLIST for the source hosts and ports. Configure HTTPS at the site's approved ingress and use site-managed certificates and broker credentials. The repository's anonymous development broker listeners and development certificates are test facilities; replace or disable them for a real deployment.

Start the standard stack from the repository root:

```text
docker compose up -d --build
docker compose ps
```

The API waits for PostgreSQL, applies pending migrations when enabled and becomes healthy when its database check succeeds. The worker then starts with migrations disabled. If a controlled release process runs migrations separately, set the API migration flag accordingly and run exactly one migration owner.

Verification: frontend, API, worker and required infrastructure report healthy. Open the frontend and check the API health endpoint at /api/health. Verify worker /health/live and /health/ready inside the container on port 4005. A healthy frontend alone does not prove the worker or database is ready.

# Stage 3 Create the first administrator

On an empty database run the compiled bootstrap command inside the backend container. Replace every bracketed placeholder, use an individual administrator address and keep the password out of shared transcripts. Explicitly supply organization and plant codes and names so the script does not create its default names.

```text
docker compose exec backend node dist/scripts/bootstrap-admin.js --email <administrator-email> --password <unique-password-at-least-12-characters> --name <administrator-name> --org-code HDPE --org-name HDPE --tenant-code HDPE --tenant-name HDPE
```

The bootstrap script requires email and password, lowercases the email and rejects passwords shorter than twelve characters. Name defaults to Administrator only if omitted. Organization code/name otherwise default to default-org/Default Organization, and tenant code/name to default-plant/Default Plant. It reuses a matching code or creates the organization and plant, then creates a SuperAdmin and a plant scope. It refuses a populated users table unless --force is supplied. --force is an exceptional additional-administrator operation, not a normal fresh-install option.

Sign in through the frontend. Confirm the organization and plant selection before making changes. Create the operating users through the administration screens and assign their intended plant and unit scopes. Keep the bootstrap account for controlled administration.

Verification: the administrator can read the new hierarchy and ordinary users can see only their assigned scope. A viewer cannot create or edit business records. A user assigned only unit100 cannot silently read or mutate unit200.

# Stage 4 Establish organization plant and display settings

If adding a plant to an existing installation, use a SuperAdmin account to create the organization if needed. In Admin, a SuperAdmin can create a plant in any permitted organization; an organization administrator can create a plant only within their own organization. Plant administrators can open Admin but cannot create organizations or plants. Organization creation and deletion, plant deletion and application-wide branding remain restricted to SuperAdmin. Enter Code, Name and optional Description. For a plant, also select Organization and its required IANA Time zone. Use stable unique codes; the display name is not the database identifier.

Select the plant in the header. In Plant settings, configure calendar system, digits and reporting week. Time zone is read-only on that page: review its displayed source rather than looking for an edit control there. The initial plant time zone is entered during plant creation; the operational clock and day start belong to the site/calendar configuration. The default calendar site is created on first use if absent, using the plant's valid time zone and a 06:00 operational day start; missing or invalid time zones cause a flagged UTC fallback. Units with no explicit site assignment use this default site. Confirm the site's clock and day start before publishing a calendar. The seeded HDPE example uses Asia/Tehran, a Persian calendar and Saturday reporting week; these are example decisions, not automatic requirements for another country or site.

Verify the header breadcrumb, dates and quantities on several pages. Confirm that exported machine values remain ISO and Latin where specified. Choose USD or IRR in the header as a personal display preference; this does not configure the finance exchange rate.

Verification: all administrators agree on the plant clock and operating boundary. A displayed time is consistent with a known timestamp from the source system.

# Stage 5 Create units assets products and attributes

Create unit100 and unit200 in the HDPE plant. Create Extruder1 under unit100 and Extruder2 under unit200. Create any supporting equipment only when it has a defined role in event recording, failure analysis, measurement or standby operation. Confirm each asset's unit, code, name, status and classification before saving.

Create the product or grade records that each unit actually produces. For every grade that will be used in production profiles or plans, change Available to from its default, All plants of the organisation, to This plant only before saving. Availability cannot be changed on the edit page. Organization-wide products are shared reference records and are not eligible as the plant-owned products required by profiles and plans. Enter Name, Code, Unit of measure and optional Description with consistent quantity units. The folded Standard cost (unconfirmed) is a legacy reference and does not configure approved finance valuation. A grade code used by PI or MQTT must map to the correct application product; matching a similar display name is not sufficient. Product family is not a field on this product form; configure supported transition keys in the transition-standard workflow.

Define custom attributes only where a business field is not already represented by a standard field. For each attribute decide entity level, name/key, type, required state, allowed options, default and validation. Definitions support Organization, Tenant, Unit and Asset levels; the current administration screens provide generated value-entry dialogs on Unit and Asset details. Do not assume that defining an Organization or Tenant attribute adds an input to hierarchy creation. Populate each required value explicitly: the Unit/Asset value editor starts from the stored value or blank and does not automatically insert the definition's default. A custom field list is plant-configured, so its actual labels cannot be universal across installations; the attribute definition and entry procedures document how every generated field is determined.

Verification: the header tree shows the intended hierarchy. Unit and asset lists contain no unintended duplicate codes. A new event for unit100 offers the intended assets and products.

# Stage 6 Load code libraries and decision policies

Create the reason tree from broad categories down to operator-selectable leaf reasons. Populate impact, OEE, loss-category, failure-group and failure-dictionary records. Define equipment class, maintainable item, failure mode, mechanism, cause and detection vocabulary where used. Set criticality based on the site's approved assessment.

Configure the RCA cause library, templates and verification checklists through their Master data pages. These pages do not provide separate administration forms for evidence-category/location dictionaries or verification-status definitions. Configure supported RCA trigger policy through its own workflow. Configure micro-stop thresholds and transition allowance policy. Define unit-state values and stale/heartbeat behavior using the source contract. A value such as stopped must have a precise business meaning, including whether it is planned, internal, starved, blocked or standby.

For reason-code default mappings, choose Mapping and Default on the code's Default mappings tab, review the effect on recent events, and use Save as next version. That mapping flow has no separate draft-activation step. Declarative rules in the Rules workspace do have drafts: validate their structure, simulate representative records, inspect matches and nonmatches, then obtain independent activation. Include a negative example so a rule is not accepted merely because it matches one convenient event. Retire obsolete codes through the supported workflow while preserving historical interpretation.

Verification: operators can find the correct leaf reason; rules propose the expected coding; unmatched input remains visible for review rather than silently assigned a misleading default.

# Stage 7 Publish calendars and crew assignments

Create the site calendar and draft version. Enter the plant day start, effective range, each shift's name and start/end, overnight behavior, holidays and exclusions. Add crews and the required rotation. Review every repeated row before publication.

Preview shift instances over representative normal days, a weekend, a holiday and a daylight-saving boundary if relevant to the time zone. Confirm that shifts cover the intended operating time without unintended overlap or gaps. Check which local date owns the overnight shift.

Publish the reviewed version. Confirm materialized shift instances are available over the intended planning horizon. Later changes must use a new version; do not edit approved historical schedule context directly.

Verification: a known production timestamp falls in exactly the intended shift and production day. The upcoming plan window has eligible scheduled time.

# Stage 8 Approve production profiles rates and topology

Create a production profile for each applicable unit and product context. Enter the sustained and planning rates in the correct units with effective dates. Complete the applicable rate-version and approval fields. Use a separate eligible approver. Check that no forbidden approved overlap exists.

Enter transition standards for actual from-grade/to-grade combinations, with the relevant catalyst family and operating mode. Confirm whether standard transition allowance is already included in the plan target. This prevents charging the same allowance twice.

If the plant uses parallel streams, define stream shares and product runs before relying on stream accounting. If downstream units depend on upstream material flow, define the supported route, buffer inventory, inventory unit and downstream draw per hour with evidence. The Plant flow route form does not expose a separate lag input; measurement-boundary lag belongs to source-authority configuration. Leave optional topology unconfigured when it is not applicable; do not invent a flow merely to populate a screen.

Verification: a short calendar window produces the expected capacity from approved rates. Rates and product units are compatible. Missing rates produce an explicit issue rather than an unexplained zero.

# Stage 9 Configure finance source authority and tolerance

Finance authors the valuation policy and rates, enters effective FX data and configures demand status where applicable. An independent finance approver approves the intended versions. Confirm the treatment of contribution margin, standard cost, operational cost and quality economics. A provisional FX rate must be explicitly identified and authorized.

Production accounting or integration authors source authority for each unit and measurement boundary. Enter the ranked sources or named signals, fallback conditions, conflict tolerance, lag and any cross-boundary adjustment evidence. A production accountant other than the author must approve the draft before it becomes effective. Source status mappings are also drafted by integration or production accounting and approved by a different production accountant, using plant-wide permissions. Each source status maps to released=true or released=false; an unmapped status or absent approved mapping is not released. This mapping determines release eligibility, not a separate three-state provisional/rejected workflow.

Prepare the uncertainty budget using actual instrument and method evidence; production engineering, integration, production accounting, management or metrology can author it with the required unit scope. A metrology approver other than the author approves it. A production accountant or manager approver who is not the budget author can then adopt an approved, effective budget that is not past its review date as tolerance where justified. Do not increase tolerance to conceal missing production or a mapping error.

Verification: a test quantity has the expected valuation in both available currencies, missing FX stays unavailable, an alternate source does not double-count output, and an unapproved estimate cannot silently become authoritative.

# Stage 10 Connect the first data source

For MQTT, obtain the broker URL, transport, authentication, trust chain, client identifier policy, allowed topic filter and payload contract from the source owner. The application subscribes; publishing test data belongs to a separate authorized source or simulator. Complete and save the four-step connection wizard, then use Test connection on the Subscription tab and review the Payload profile. Connection diagnostics run after the connection exists. Enter credentials only into the write-only fields.

Map identity, timestamp, quality, unit/asset/product context, field paths, value maps and event or signal semantics. Confirm units, timestamp units and time zone, boolean/state values, null behavior, source identity and revision behavior. Expand advanced groups and explicitly review their defaults. A successful broker connection does not prove the payload maps correctly.

For PI, configure the actual Web API endpoint and credentials, run the staged diagnostics, browse the source hierarchy, discover the intended templates and attributes, and build mappings to application units, assets and products. Preview representative closed and open event frames and signal values. Do not enable broad historical backfill before validating the mapping.

Create or enable the bounded ingestion job or subscription. Observe raw observations, mapped events or samples, counters and quarantine. Check at least one running interval, one real stop, one quality condition, an open-to-closed update, a duplicate/replayed identity, bad quality and an unmapped record. Confirm user coding survives a source update.

Verification: the canonical record has the intended unit, asset, product, time, quality, source identifier and revision. Quarantine contains expected invalid examples with a useful reason. Pause and resume behave as documented. No duplicate active subscription or test clone is consuming the production feed unintentionally.

# Stage 11 Create and approve the first plan

Create the scenario, select the accounting baseline as intended and create a plan with its unit, profile, window and target. Add each sequential product slice and its applicable target. Review boundaries against the published calendar and approved rates.

Generate periods and wait for the job to finish. Inspect the period grid, target sum, eligible duration and product assignment. Confirm that rounding is absorbed without changing the total target. Submit and approve using the required role and independent reviewer where applicable.

Verification: the generated target sum equals the plan target, the expected shifts exist and no period relies on a missing or wrong-unit rate.

# Stage 12 Commission one complete production period

Select a short representative shift. Ingest or record its output, downtime and quality events. Use the Event Hub to review source facts, effective coding, stop closure and failure detail. Confirm full stops, fractional losses and equipment-only events have different intended effects.

Open the plan period. In Actuals inspect source provenance, quantities, quality and distribution method. Resolve missing data or conflicts at their source. Record an adjustment or disposition only with its reason, evidence and required independent approval.

Recompute and wait for completion. In Reconciliation inspect both ledgers separately. Accept or explain candidates, add justified manual lines and any permitted bridge, then save. Check residual, evidence and warnings. In Value inspect currency, valuation basis and provisional/missing-rate flags. Use History to establish which calculation and revision are being reviewed.

Submit the draft. Have an independent eligible person approve it. Also test one controlled rejection and correction in the commissioning environment. Verify that a stale edit receives a conflict and preserves the editor's draft. Confirm a viewer sees the same approved result without command controls.

Verification: approved quantities reconcile, the approval snapshot is immutable, and reports read the intended approved revision. The plan and capacity ledgers are never summed together.

# Stage 13 Commission day close month close and RCA

Approve every shift requiring reconciliation for one production day and have a manager approver who submitted none of those shifts certify the day. An excluded period with no reconciliation does not require approval. Resolve every prerequisite for a representative month in a commissioning environment. A plant-wide manager approver closes quantities; complete the independent materiality review if required by policy, then obtain finance sign-off from someone other than the quantity signer and materiality reviewer. A plant-wide finance approver locks the month. Verify direct revision and ordinary reopen are refused once locked. Exercise a reasoned after-close change proposal and its decision process rather than editing the database.

Create or link an RCA from an appropriate event. Fill the definition and team, add evidence, complete the required analysis method, record the root cause and move through investigation acceptance. Create an action with owner, due date, type, completion evidence, baseline metric and verification window. Verify effectiveness after the window, record residual risk and request closure. An independent manager approves closure.

Verification: self-approval is refused, the RCA outcome separates claimed and realized benefit, and the linked event reflects the completed investigation. A case with insufficient evidence is not falsely presented as effective.

# Stage 14 Accept the plant and hand over operations

Run the persona acceptance matrix in the Operations and Verification Guide. Include administrator, integration, operator, production, accounting, quality, metrology, finance, reliability, manager and viewer behavior, plus a restricted-unit user. Check desktop and narrow-screen views, every configured filter, details links, empty/error states, draft retention and export downloads.

Take and restore a backup in an isolated environment. Disable copied source connections before starting the restored worker. Confirm the restored hierarchy, recent approved period, representative attachment and connector credential availability. Record the restore result, image/revision identifiers and migration version.

Record all unresolved gaps, source certification limits and accepted restrictions. Obtain plant-owner acceptance of actual rates, calendars, source mapping and approval responsibilities. Retire commissioning fixtures through the approved data process. Begin the first operating shift with named support ownership and the daily checklist.

Verification: a complete source-to-approved-report-to-RCA journey is demonstrated using the plant's actual configured boundaries and independent users. Installation health alone is not the acceptance criterion.
