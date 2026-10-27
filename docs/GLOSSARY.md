# Glossary of screen terms

Owner decision 2026-10-18 (`plans/DECISIONS.md`, UX audit H-12). These rules cover words people see
(labels, titles, aria-labels, toasts, descriptions). API field names, enum values, routes and test ids
keep their own names (`residual`, `rcaId`, `rca-cases`, `tenant`).

Reused words live in `src/features/ux-kit/labels/`: `GLOSSARY` (`glossary.ts`) and `eventNoun` /
`eventNounOfAll` (`event-labels.ts`).

## Canonical terms

| Term | Means | Do not use |
| --- | --- | --- |
| **Event** | The generic production record of any kind (downtime, slowdown, quality loss, output, advisory, grade transition). | — |
| **Stop** | An event of kind `downtime`. | "downtime event" in a downtime-only screen |
| **Unaccounted** | The reconciliation residual: gap − attributed − tolerance adjustment (server figure), and loss lines of kind `unaccounted_classified`. | Residual, Unexplained, Shortfall (for the residual), "Unaccounted (classified)" |
| **Gap** | Target − actual. A different figure from Unaccounted. | — |
| **Gross attributed loss** | Σ the loss kinds of a period on the statement: availability + performance + quality (+ transition excess and loss classified as Unaccounted). Recovery is not subtracted. | Total loss |
| **Verified recovery** | Production recovered against the shortfall (a `gain` line; in declared mode a split entry marked Recovery), shown with a minus sign. Labelled "Recovery (unverified)" until a supervisor verifies the event coding. | Gain (on the statement), negative loss |
| **Net accounted loss** | Gross attributed loss − Verified recovery. Shortfall − Net accounted − tolerance adjustment = Unaccounted. | Attributed (on the statement) |
| **Declared loss** | The production loss OT declares for a unit and day (planned, actual, shortfall). Under the declared basis the shortfall, split by reason, is the loss; stops do not create loss lines. | — |
| **Production loss event** | The event that holds one declared loss: one per unit per day, covering the accounting period, with the shortfall as its quantity. Coded in the Event Hub. | PLA report |
| **Loss accounting policy** | The approved plant setting for grain (shift / day), loss basis (computed / declared), target source, accounting unit, stops cross-check and identity tolerance. | — |
| **Stops cross-check** | Stop time times the planned rate, shown beside the declared shortfall to compare. It never becomes a loss line. | — |
| **Identity** | The rule planned − actual = shortfall, within the plant's tolerance. A break raises a review item and blocks submission. | — |
| **Investigation** | An RCA case. The module and the nav item keep the name "RCA". | case, RCA case |
| **Action** | A corrective action of an investigation. | — |
| **Recommendation** | A proposed action of an investigation (stays "Recommendation"). | — |
| **Task** | A Task Management item. A task made from a recommendation: "Create task from recommendation". | action item |
| **Whole plant** | A record or grant with no unit limit. | Tenant-wide |
| **Organization** | US spelling everywhere. | organisation |

Statistical "deviation" and RCA "residual risk" are different concepts and keep their names.

## Per-module rules

- **Event Hub** lists every kind, so the list, filters, selection and generic actions say "event".
  Downtime-only parts say "stop": current stops, Close stop, "To code", duplicate and repeat stops.
  Actions on one record take the noun from its kind (`eventNoun(kind)`): "Retract this stop?" for a
  downtime event, "Retract this event?" otherwise; Split, Merge (stop only when every merged event is a
  stop), Code and the conflict dialog follow the same rule.
- **Downtime analysis** shows only downtime: "stop" (Stop records, drill-down "Stops · …"). Partial-impact
  figures that include slowdowns keep "events".
- **Plan dashboard / Period accounting / PLA analytics**: the residual column, figure, waterfall bar,
  count row and trend say "Unaccounted"; the unexplained-loss ratios read "Unaccounted / gap" and
  "Unaccounted / plan". "Gap" stays target − actual.
- **RCA**: list, workspace, filters, dialogs and errors say "investigation"; tasks of an investigation are
  "Create investigation task"; the nav item "RCA Analysis" is unchanged.
- **Scope**: unit selectors and knowledge entries without a unit show "Whole plant". The PLA site filter
  keeps "All sites" (it chooses among the sites of one plant).
