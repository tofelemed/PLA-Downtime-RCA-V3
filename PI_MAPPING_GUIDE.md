## PI → ProAct Mapping Guide (Detailed)

This guide explains how to map AVEVA PI Event Frame (EF) templates and attributes to ProAct event fields without code changes.

### What you’ll achieve
- Use your own PI templates (no hardcoded names required)
- Choose an event type per template (ProductionLoss, IOW, SOL, APM, FailureWO, ProductionOutput)
- Map EF attributes to ProAct fields used across dashboards and workflows

---

### Key concepts
- Template: The EF template name in PI (e.g., “Motor Downtime”, “IOW Deviation”). Templates are discovered dynamically from PI.
- Event Type: How ProAct will treat events from a template. Choose one per template.
- Mapping: Attribute-level wiring from PI EF → ProAct event fields.

---

### UI workflow (recommended)
1) Connectivity → AVEVA PI → AF Hierarchy
   - Pick Scope: Element (Root) or Database
   - Select Asset Server, AF Database, and (if Element) a Root Element
   - Save AF Selection

2) Connectivity → AVEVA PI → Mapping
   - Click “Discover templates” to pull real template names for the current Scope + Time window
   - For each relevant template:
     - Select an Event Type (see guidance below)
     - Click “Load attributes” to fetch EF attribute names
     - Map EF attributes to ProAct fields
   - Click “Save Mappings”

3) Test quickly
   - Event Frames tab → choose template → set Start/End (UTC, include Z) → Load
   - Sync & Status tab → Backfill Range (small window) → confirm created events

---

### ProAct event types and typical mappings

Use these suggestions as a starting point. You can map only the fields you need.

- ProductionLoss (downtime/throughput loss)
  - description, quantity, cost, reasonCodeId, oeeCodeId, impactCodeId, lossCategory, shift, crew

- IOW (Integrity Operating Window) / SOL (Safety/Operational Limit)
  - parameter, limit, limitType, description, severity

- APM (Asset Performance/Health)
  - apmType, severity, recommendedAction, description

- FailureWO (Failure Work Order)
  - workOrderId, failureMode, severity, description

- ProductionOutput (counts/rates)
  - quantity, description

---

### Mapping targets (current field list)

These are the available app fields in the Mapping UI:

- description
- reasonCodeId
- oeeCodeId
- impactCodeId
- quantity
- cost
- shift
- crew
- lossCategory
- parameter
- limit
- limitType
- recommendedAction
- apmType
- severity
- workOrderId
- failureMode
- defectiveQuantity

Notes:
- Leave any attribute unmapped if it’s not useful.
- If you need a new target (e.g., “status”), you can extend the mapping list later (see Extending section).

---

### How to choose mappings (practical heuristics)

- Text/name fields → description, parameter, recommendedAction, failureMode, workOrderId, lossCategory, shift, crew
- Boolean/status-like → description (e.g., “Running Status”), or parameter if it’s a tag you’ll filter by
- Numeric quantity → quantity or defectiveQuantity
- Money/cost → cost
- Limit/excursion → parameter, limit, limitType
- Severity/priority → severity

Tip: Prefer short, meaningful descriptions. Put detailed text in description; the rest goes to typed fields for filtering/analytics.

---

### End‑to‑end examples

1) Template: “Motor Downtime” (ProductionLoss)
   - EF attributes: ReasonText, DowntimeMinutes, CostUSD
   - Map:
     - ReasonText → description
     - DowntimeMinutes → quantity (or leave unmapped if you only track count)
     - CostUSD → cost
   - Optional: reasonCodeId/oeeCodeId/impactCodeId if you maintain code libraries

2) Template: “Pressure High” (IOW/SOL)
   - EF attributes: TagName, HighLimit, LimitType, Message
   - Map:
     - TagName → parameter
     - HighLimit → limit
     - LimitType → limitType
     - Message → description

3) Template: “Work Order Trigger” (FailureWO)
   - EF attributes: WO_ID, FailureMode, Severity, Note
   - Map:
     - WO_ID → workOrderId
     - FailureMode → failureMode
     - Severity → severity
     - Note → description

4) Template: “Production Output” (ProductionOutput)
   - EF attributes: GoodUnits, Comment
   - Map:
     - GoodUnits → quantity
     - Comment → description

---

### Handling unknown/no template EF

- “All templates”: Use this only to preview; attribute loading needs a concrete template name.
- “*NoTemplate*”: For EF without a template. Pick an Event Type and map minimal attributes (e.g., description). This is a fallback.

---

### Scope & time window tips

- If attributes fail to load or you see no EF:
  - Switch Scope to Database (broader) in AF Hierarchy
  - Widen the UTC Start/End (include Z), e.g., last 7–30 days
  - Use “Discover templates” again in Mapping

---

### Validating mappings

1) Event Frames tab → Load a focused window for a chosen template
2) Sync & Status → Backfill Range for the same window
3) Check events (e.g., EventHub) to confirm mapped fields populate as expected

---

### Troubleshooting

- Error 400 on “Load attributes”
  - The selected name isn’t an actual PI template in the current Scope/Time. Click “Discover templates” and pick a real name.

- No EF results
  - Widen Start/End, switch to Database scope, and verify AF selection is saved.

- EF shows but no events created on sync
  - Ensure the EF’s primary referenced element is bound to a Unit/Asset (AF Hierarchy tab → bind buttons). Unbound EF are ignored to avoid orphan data.

---

### Extending mapping fields (optional)

If you need a new mapping target (e.g., “status” or “duration”):
1) Add the field to the app’s event schema (e.g., ProductionEvent) and persistence layer
2) Add the new key to the Mapping UI’s field list
3) Re-run mapping for relevant templates

This keeps the UI flexible while allowing richer analytics over time.

---

### Glossary
- EF (Event Frame): PI object representing a time-bounded event
- Template: PI metadata describing EF structure
- Mapping: Attribute-to-field wiring for creating ProAct events from EF

