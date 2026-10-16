# Purpose and operating model

Traverse Forge records production events, accounts for lost production, values the approved losses and supports root cause analysis. ProAct and Pro-Act remain in package, database and container names. The system is an information and approval application. It is not a plant control system and does not command an extruder, change a process setpoint or publish operating commands to an MQTT broker.

The working sequence is: configure the plant, publish calendars and rates, approve a plan, collect observations, calculate actual production and losses, reconcile and approve each period, certify production days, close the month, investigate causes and verify actions. These are connected records rather than independent dashboards. A missing upstream configuration can therefore appear as a blocked calculation or approval downstream.

The supplied HDPE environment is a synthetic industrial test scenario. It contains one HDPE organization and HDPE plant, with unit100 and Extruder1, and unit200 and Extruder2. Supporting equipment, products, source records and personas make the workflows testable. Its rates, prices, limits and event history are examples. They are not a process design specification, actual measurements from a commercial plant or approved settings for a new site.

Read the Page and Field Manual for every screen and control. Use the New Plant Setup Guide in dependency order. The Operations and Verification Guide explains daily work, recovery and the limits of the validation evidence.

# System architecture

The browser runs a React 18 application built with Vite and TypeScript. Feature modules own their pages, forms and queries. React Router supplies browser routes. TanStack Query caches server data by plant and query context. Shared components format time, dates, quantities, status, permissions and errors consistently. Form validation and view state run in the browser; authoritative accounting, valuation, workflow and authorization decisions run on the server.

The frontend image serves static files through nginx. The same origin proxies /api and Socket.IO to the NestJS backend. This avoids a separate browser API hostname in the normal deployment. The built frontend uses VITE_API_BASE_URL=/api. An absolute alternative is a build-time choice; changing a frontend container environment variable alone does not rebuild the bundle.

The backend image runs in two roles. The API process handles authenticated HTTP requests, validation, commands and queries. The worker runs schedulers, source connectors, calculation jobs, exports, retention and other asynchronous work. PROCESS_ROLE selects api, worker or all. The normal Compose deployment separates api and worker. Only the API owns startup migrations; the worker waits for a healthy API and never applies migrations concurrently.

PostgreSQL stores master data, observations, events, plans, calculation runs, approvals and audit records. TypeORM migrations define the schema; synchronize is false. The application uses exact decimal arithmetic for quantities and money, UTC timestamps for storage and plant-local calendar rules for operational boundaries. The current local HDPE database uses PostgreSQL 15; the standard bundled Compose service specifies PostgreSQL 16. Treat these as different deployment facts.

The bundled development stack also includes MQTT and Kafka. MQTT is used by the implemented intake workflows. The presence of a broker or a configuration screen does not itself prove that every potential industrial protocol has a production-ready source adapter. PI workflows require an available PI Web API and the plant's source administrator. External source acceptance must be performed against the actual site systems.

Source reference: src/App.tsx; src/app/routes; src/api/v2; docker-compose.yml; Dockerfile; server/pro-act-backend/Dockerfile; server/pro-act-backend/src/database/data-source.ts.

# Identity scope and permissions

The hierarchy is Organization, Plant, Unit and Asset. A plant is also called a tenant in the API and database. Products, codes and configuration belong to a defined scope. Selecting an asset retains its unit and plant context. Selecting an organization alone is not the same as choosing an operating plant.

A user's account role and scoped roles are resolved into effective permissions in the acting plant. A role on one unit does not imply a grant on another unit. The header's plant directory is already limited to authorized records. Menus use capabilities to hide unavailable modules, but the backend still authorizes every request. A copied URL or manually crafted API call does not create permission.

The typed client sends the access token, acting plant header, correlation identifier and, where required, If-Match and Idempotency-Key. The server derives a request context and checks the requested plant against the authenticated user's grants. Database row-level security binds tenant access at request time. Query parameters are filters, not a way to grant a tenant or role.

Read-only users cannot perform ordinary business writes. Special read-like commands, such as validation previews, are explicitly identified by server policy. Role gates differ by operation: authoring a rate, approving a rate, recording a disposition and approving a disposition are separate capabilities. The role matrix appendix is taken from the current server-aligned role sets.

Approval independence is a business rule in addition to having the correct role. Period authors and submitters cannot approve their own work. Finance authoring and approval are separate. An RCA closure approver must be independent of the investigation, including its recorded past participants. A global administrator does not automatically bypass these workflow checks.

Delegation records a bounded role assignment with its reason and dates; the delegated role can include authoring as well as approval permissions. The supported roles are manager approver, production accountant, finance approver, quality approver and metrology approver. The delegator must hold the role on the delegated scope, cannot pass on a received delegation and cannot delegate to themselves. A delegation lasts at most 90 days and stops applying at its end time or revocation. It does not erase authorship or independence conflicts. Audit records and workflow histories should be used to establish who acted, under which scope and at which revision.

Source reference: src/features/auth/effective-roles.ts; src/features/auth/capabilities.ts; src/features/auth/server-role-sets.ts; server/pro-act-backend/src/auth; server/pro-act-backend/src/domain/rca/case-workflow.ts.

# Time quantity and display conventions

Stored event intervals are half-open: the start is included and the end is excluded. Adjacent events can therefore meet at a boundary without double-counting that instant. An open event has no actual end. Duration is derived in seconds. Plant-local inputs are converted using the plant time zone; UTC storage does not mean an operator should type UTC into a field labelled with the plant clock.

The production day may begin at a time other than midnight. The seeded HDPE calendar uses Asia/Tehran and a 06:00 day start. Each plant has a default calendar site, created on first use when absent; it starts with the plant's valid time zone and a 06:00 operational day start. An absent or invalid plant time zone produces a flagged UTC fallback. Units without an explicit site use that default site. Shift instances, day certification and financial month windows must be interpreted using the configured calendar. The user's computer time zone is not the plant's accounting boundary.

Calendar system and digit preferences control display. They do not change stored ISO timestamps, API identifiers or CSV machine values. Week start controls reporting buckets; it does not define which days are nonworking. Holidays, exclusions and working shifts belong to the calendar configuration.

Quantities carry a unit of measure. A number in tonnes cannot be compared with a rate in kilograms per hour without an explicit configured conversion. Missing measurements remain unavailable, rather than being substituted with zero. A measured zero means the source actually supports a zero value.

The currency switch selects the server's USD or IRR result. It never performs an exchange-rate conversion in the browser. Missing rates, provisional rates and unvalued quantities must remain visible to the reader.

# Configuration and versioned master data

Organizations and plants establish administrative ownership. Units establish the production accounting boundary. Assets identify equipment within units. Products identify output grades. Code libraries provide consistent reasons, impacts, OEE classifications, failure terms, RCA causes and verification vocabulary. Dynamic attributes extend the configured record types; their definitions determine the extra fields a particular plant sees.

Product availability is selected at creation and is not editable afterward. Production profiles and plans require a product owned by their plant; choose This plant only for those grades. The product form defaults to organization-wide availability, which serves shared reference products. Legacy unit capacity, cycle time and product standard cost are reference values, not the approved v2 production rates or finance valuation inputs.

Custom attributes have a defined type, label, help, ordering, required flag and validation rules. The current Unit and Asset detail pages generate their value editors from active definitions. An unset value remains blank in these editors even when the definition carries a default; record required values explicitly. Organization and Tenant definitions do not create value-entry controls on the hierarchy-creation form.

Versioned configuration separates a draft from the effective approved version. Effective dates matter: a future rate should not silently rewrite an earlier period, and two approved versions must not overlap where the contract forbids overlap. Retired codes remain interpretable on historical records. Deleting or renaming a display item is not a valid way to restate approved production history.

The workflow depends on the configuration type. Profiles, finance rates and declarative rules have their specified draft and approval steps. Reason-code default mappings save directly as a new version; micro-stop and transition-allowance policies are recorded by an authorized manager as versions effective now. These direct version commands do not have an additional independent activation screen.

Declarative rules apply conditions and actions to supported events. Validation and dry runs show whether the rule is structurally valid and how it matches existing data. Activation, version comparison and rollback preserve reviewable configuration history. A rule that automatically proposes coding still needs the normal downstream review where required.

Source authority, source status, unit state, micro-stop thresholds, transition allowances, RCA trigger policies, finance policy and uncertainty budgets each have distinct purposes. Do not use one setting to compensate for an error in another. For example, increasing reconciliation tolerance does not correct a wrong measurement boundary.

# Calendars rates plans and periods

A site calendar version defines local day start, shifts, holidays and excluded time. Publishing creates immutable schedule context and materialized shift instances. Crews are assigned through the calendar and rotation configuration. Preview is the place to check overnight shifts, daylight-saving boundaries, overlaps and gaps before publishing.

A production profile groups the effective unit-product rates. Sustained rate defines approved capability. Planning rate defines the production plan basis. Transition standards describe allowed grade-change time or quantity under their configured grade, catalyst and operating-mode keys. Finance valuation rates are separate from production rates.

A plan belongs to a scenario and has versioned product slices. One scenario supplies the accounting baseline. Period generation distributes the target over eligible scheduled time and approved rates. It uses exact decimal quantities to eight stored places; the last positive-weight period receives the rounding remainder. A positive target with no eligible time is refused with NO_ELIGIBLE_TIME. A missing profile is an explicit data problem, not permission to invent a rate.

A production period represents a unit's shift context. Its product slices allow the accounting engine to evaluate grade boundaries consistently. Plan versions, production periods and accounting revisions are different objects: the plan states the target, the period states the operational window, and the accounting revision states the reviewed explanation of results.

Changing a valid upstream input can trigger recalculation of open work. Approved work requires a change proposal or revision process. Superseded versions remain historical context and are not editable as if they were current drafts.

Source reference: server/pro-act-backend/src/domain/plans/target-distribution.ts; server/pro-act-backend/src/domain/plans/period-generator.ts; src/features/planning; src/features/plan-dashboard.

# Observation intake and event history

An integration connection stores how to reach the source. A payload profile or mapping defines how source fields become canonical values. A job or subscription controls when data is read. These three layers should be checked separately when troubleshooting.

The intake path persists a raw observation before it is acknowledged. Identity and revision handling prevent a replayed message from creating a second unrelated event. Mapping resolves the plant hierarchy, field values, timestamps, quality and source identity. Valid observations produce events or signal samples; invalid observations remain in quarantine with their reason and raw evidence.

An event stores source facts separately from human coding and corrections. Effective values overlay the current user layer on the source layer. A later source update does not silently erase an operator's correction. Conflicting source changes can create review items. Retraction and supersession preserve history instead of hard-deleting the evidence.

Physical event type, schedule class, OEE component and impact mode are independent classifications. Downtime with full_stop is stopped time. A fractional impact is a rate loss rather than an additional full stop. An equipment problem with impact none can be valid when standby equipment maintained production. Origin equipment and origin unit can identify a cause elsewhere in the process.

The Event Hub supports server-filtered lists, details, coding, closure, splitting, merging and bulk operations. A preview precedes bulk work. Long operations return jobs. Concurrent edits carry version checks; a conflict requires reviewing newer server content, not repeatedly submitting an old draft.

Quarantine recovery should correct the mapping or source problem, dry-run representative records, then replay a bounded selection. Marking a record irrecoverable records an explicit disposition. Blindly replaying an uncorrected batch only repeats the same failure.

# Actual production and measurement authority

Actuals select one authoritative quantity for a slice. The configured hierarchy ranks eligible measurement sources at the defined boundary. A lower-ranked source is used only under an allowed fallback condition, such as missing, stale or bad-quality primary data. A disagreement is reported as a source conflict; the engine does not average or add competing measurements.

An explicitly named signal removes ambiguity when several signals of the same kind exist. Cross-boundary substitution needs its documented adjustment and evidence. For example, material measured after storage is not automatically equivalent to extruder output in the same time window; stock change and lag matter.

Counter deltas, integrated rates and production-output events are separate quantity candidates selected by the configured authority policy; there is no universal counter-to-rate priority independent of that policy. A production-output event spanning periods uses its supplied measured distribution when available. Otherwise, if proportional estimation is permitted, it is split by running time where supported, falling back to elapsed time, and labelled estimated. If estimation is disabled, the event is booked whole in the window containing its end and flagged as spanning; open output events are not booked. Attribution method and coverage remain part of provenance. Counter resets, bad quality, stale values and gaps need investigation rather than a fabricated production total.

First-pass good output, gross output and disposition quantities are distinct. Wide-spec, downgrade, transition off-grade, scrap and rework must remain separate. A recovery movement does not retroactively make the original material first-pass conforming output. Disposition authoring and independent quality approval preserve that distinction.

Actuals adjustments record an explicit reason and evidence, and require approval by a manager approver other than the author. An uncertainty budget documents measurement uncertainty and its basis; a metrology approver other than the author approves it. Adopting an approved, effective and not-overdue budget as a reconciliation tolerance is a separate production-accountant or manager-approver decision, again by someone other than the budget author. Tolerance is not a replacement for source quality checks.

Source reference: server/pro-act-backend/src/domain/actuals/period/authority.ts; server/pro-act-backend/src/domain/actuals/period/output-distribution.ts; server/pro-act-backend/src/domain/uncertainty/uncertainty-budget.ts.

# Loss accounting engine

Each calculation run freezes its inputs and records a fingerprint, content hash and engine version. Identical unchanged input does not require a new result. The current accounting engine identifies itself as 2.7.0. Validation and conservation checks run before a new result becomes current. A failed run must not replace the last valid calculation.

The engine cuts each product slice at relevant time, rate, schedule and event boundaries. It allocates overlapping causes once according to policy. Both ledgers describe the same underlying production history, using different baselines. Their values must never be added together as if they were separate losses.

The plan ledger asks why actual good output differs from the target. Its gap is target less actual good output. Attributed lines plus the signed residual equal that gap. Automatic time losses use the planning-rate shape scaled to the target when necessary, with a flag identifying the scaling. Without an eligible planning rate the engine leaves allocation required rather than distributing the final gap arbitrarily.

The capacity ledger asks how approved capability was used. Its conservation identity includes exclusion, availability, performance, quality, good output, gain and residual against capacity. Performance is supported by measured production and applicable cause evidence. Unexplained quantity stays unexplained; it does not automatically become slow running.

Gross losses and recovery gains remain separate. Above-plan production does not erase a physical stop. Signed residuals preserve overproduction and over-accounting evidence. Claims exceeding a measured component are retained and flagged for review instead of silently scaled down to appear balanced.

Grade transition handling distinguishes a standard allowance from an overrun. When the plan already deducts the standard transition allowance, the plan ledger does not charge it again. Stream configuration can allocate capacity to the streams and products actually running. Material-flow configuration can derive downstream starvation after available buffer cover is exhausted, while recorded stops retain precedence. These optional configurations require valid plant-specific topology and evidence.

An illustrative eight-hour scheduled period at a constant sustained rate of 32 t/h has 256 t scheduled capability before its measured losses are considered. A full stop of 20 minutes at that constant rate corresponds to about 10.6667 t of capability. If the plan uses a different rate, its plan-ledger loss differs. The seeded 9.6 t example therefore must not be read as a universal loss for every 20-minute stop. Actual approved rates, intervals and engine results determine the final number.

Source reference: server/pro-act-backend/src/domain/accounting/period-accounting.ts; plan-ledger.ts; capacity-ledger.ts; conservation.ts; streams.ts; flow-propagation.ts.

# Reconciliation approval and close

Calculated candidate lines are the starting explanation. A reconciliation draft accepts, adjusts, replaces or rejects them and can add supported manual evidence. Draft saves are atomic and carry the original row version and calculation context. A newer calculation produces a rebase decision rather than silent replacement of an editor's work.

The period workspace separates Reconciliation, Actuals, Review, Value and History. View and ledger selections remain in the URL. Pending period drafts are held in memory by user, plant, period and revision. Returning to a retained draft offers restore or discard. Refresh or browser close warns; confirmed refresh can lose memory-only edits. Sign-out, plant or authority changes must not expose another scope's draft.

A draft is submitted for review. Submission checks required evidence, source conditions, reconciliation balance and other gates. An eligible independent reviewer approves or rejects it. Rejection records the reason, failed lines and any required follow-up. Approval creates an immutable snapshot and approved loss records. The approved result is distinguishable from a newer current calculation.

A production day is certified after the shifts requiring reconciliation are approved; an excluded period with no reconciliation does not require approval. A manager approver who submitted none of those shifts certifies the day. Revising a contributing shift reopens the day as required. Month close then progresses through open, quantities closed, finance signed off and locked. A plant-wide manager approver closes quantities. When policy requires materiality review, a permitted plant-wide reviewer other than the quantity signer completes it. A plant-wide finance approver other than both the quantity signer and materiality reviewer signs off. A finance approver then locks the month; the finance signer may also perform the lock. Open proposals, unapproved periods and uncertified days are blockers.

The month-close workspace separates Overview, Periods, Days, Proposals and History. Period and day prerequisite lists have their own sections. Large counts are totals; displayed examples are capped samples, not the entire population. Count links open the corresponding sample; resolve records through their supported period workflows and refresh the counts. The personal queue is recent assigned work, not a complete list of the month's periods. Section changes preserve the month and query context, and browser Back returns to the preceding section.

A locked month refuses direct revision and the ordinary reopen command. Reopen is available before locking, from quantities closed or finance signed off, and clears the previous sign-offs. Late source data, approved-rate corrections and manually proposed corrections use change proposals and, where accepted, a new accounting revision; after-close corrections follow that controlled process. Restatement preserves old and new figures. Operational date and financial posting date remain separate; finance records posting treatment. Reopening and restatement are audited commands, not database edits.

SLA queues track due work. Data holds identify why work waits and can pause the relevant clocks. In-app notifications and escalation history support follow-up; they do not imply an email or SMS was sent.

# Valuation and reported value

Valuation uses an approved policy, approved effective rates and applicable FX context frozen with the calculation. Contribution margin, standard cost, operational cost and economic views answer different questions. They are not additive measures of the same loss.

Both IRR and USD values can be returned. Missing FX leaves the affected currency unavailable with its reason. A permitted provisional FX value is flagged and must not be presented as final. Missing unit price leaves an unvalued quantity. Finance approval is required before a proposed policy or rate becomes authoritative.

Quality economics can distinguish scrap, downgrade and rework. Demand-constrained lost sales require their demand status. A value is meaningful only with its basis, currency, quantity and approval state. Aggregations should retain those labels and never use zero to conceal missing valuation context.

Source reference: server/pro-act-backend/src/domain/valuation; server/pro-act-backend/src/valuation; src/features/finance.

# Analytics reliability and exports

Dashboard, PLA analytics, downtime analysis, reports and bad-actor views read server results. Filters select units, time windows, products, shifts, crews and approval context as supported by the page. A filter's effect must be interpreted with the selected window and available data, especially when comparing approved and current results.

Some overview counts intentionally use a broader scope than the adjacent list. Audit Activity uses the selected period only; search, action and record-type filters apply to its entries list and export. Task Summary uses search, priority and My tasks but omits status and Overdue only so the status distribution remains visible. The pages state those scopes explicitly; do not compare a summary total with a narrowed list as if the two requests were identical.

Operational OEE and reconciled PLA OEE are separately labelled. Aggregation uses stored numerator and denominator terms rather than averaging displayed percentages. Missing terms remain unavailable. Availability inside the approved schedule includes relevant planned and external stops; a controllable view is a distinct supplemental measure.

MTBF uses qualifying functional failures and exposure. No failures does not justify displaying infinite MTBF. Active repair time requires repair evidence; total downtime to restore is a different measure. Standby equipment uses demand and test history. A bad-actor ranking is a screening tool whose exposure, recurrence and cost basis should be read before assigning an investigation.

Exports are asynchronous jobs. The supported approved-content exports pin the selected approved revisions, then generate CSV or PDF. CSV uses machine-readable ISO values and both currencies. PDF uses the display context and selected currency. Downloads are re-authorized, expire after the configured retention period and are stored privately on a shared API/worker volume. Requesting an export is not proof that its file has completed.

# Root cause analysis and learning

An RCA links relevant events and evidence to one investigation. An evidence package records the context used when linking, including the approved impact where available. The definition page owns problem, root-cause and team editing; the overview presents a compact summary and the workflow. Evidence, recommendations, analysis methods, logic tree, actions, links and outcome remain separate subpages.

Cases move from Draft to In Progress and Analysis. Moving to Monitoring requires the configured investigation gates, such as root cause, required methodology, evidence-bearing 5-Why levels and complete FMEA data. The team locks after investigation acceptance. Returning to analysis, rejecting closure and reopening require the applicable note and authority.

Actions track ownership, due date, type, status and completion evidence. Verification uses a defined window and a server-counted historical baseline. The outcome distinguishes approved historical loss, a claimed avoided loss and a measured realized result. A claim is not evidence of achieved savings.

Effectiveness can be effective, not effective or insufficient evidence. Closure requires finished or cancelled actions, completion evidence for done actions, completed required verification and a residual-risk statement. The result need not be effective for a reviewer to consider closure, but it must not be falsely labelled effective merely because tasks are done.

Only Closure Review can move to Closed, with an independent approver. The independence check includes creator, lead, members, closure requester and past investigators. Closing can publish learning to the knowledge base. Similarity suggestions assist retrieval but do not establish that another plant has the same root cause.

Trigger policies evaluate duration, quantity, recurrence, criticality, safety and permitted value limits. A recommendation is different from an automatically created case. Repeated evidence should link consistently without duplicate open cases. Provisional monetary data must retain its limitations when evaluating value-based triggers.

# API consistency background work and failure handling

The v2 client uses typed request and response contracts. Unknown DTO fields are rejected by the server's validation policy. GET requests retrieve data; commands may return a completed record or a 202 job reference. Job states and progress must be read before assuming completion. A browser timeout can leave a command outcome unknown, so check the record or job before issuing a new command.

If-Match protects optimistic concurrency. A stale version is a conflict requiring refresh and reconciliation with newer data. Idempotency keys identify a single user command across a permitted retry; creating a new key turns it into a new command. Correlation identifiers connect UI errors to backend diagnostics without exposing credentials.

Queries are keyed by tenant and filters. Mutations invalidate affected data and real-time hints refresh dependent views. A disconnected live indicator does not mean existing data is erased; it means automatic freshness must be checked. Scope changes must clear or reject stale results from the previous authority context.

Use 400 for request-shape investigation, 401 for authentication, 403 for role or scope restrictions, 409 or 412 for state/version conflicts, 422 for business validation and 429 for throttling. A 500 or 503 requires service diagnostics and the correlation identifier. Do not change plant facts merely to make a failing HTTP request disappear.

# Data lifecycle and operational ownership

Raw observations, signal samples, audit logs, approved accounting and exports have different retention rules. Default Compose values keep raw observations for 365 days, measurement samples for 90 days and audit records for 30 days; raw and sample partitions are removed by whole monthly partition. Approved accounting is retained. Export availability defaults to 168 hours. Verify the configured values and regulatory retention requirements before commissioning.

Backups must include PostgreSQL, uploads, private exports if required, deployment configuration and credential encryption keys. A database backup without the key needed to decrypt connector credentials is incomplete for recovery. A backup is only proven by a successful isolated restore and application checks.

Product code, schema migrations, runtime configuration and plant configuration are separate release concerns. Restore and test changes in an isolated environment. Disable copied subscriptions before starting a restored worker so a test clone does not duplicate production ingestion. Never point destructive test harnesses at the production database.

Source reference: docker-compose.yml; server/pro-act-backend/src/database; server/pro-act-backend/src/common; docs/DOCKER.md.
