# Accounting policies — JSON Schemas and seed defaults

Plan sub-phase **0.2** steps 3–5 (`plans/phase-0/0.2-decision-register.md`, target design item 2). Every site-specific rule the spec leaves open (§21 D01–D15) is a **versioned, effective-dated, approved policy document** stored in `accounting_policies`, validated against one schema per `policy_kind`, and recorded by version on every calculation run. Changing a rule is a configuration change with history, never a code change (§21 "unresolved defaults become visible configuration").

## Layout

| Path | Purpose |
|---|---|
| `policy-envelope.schema.json` | Shared `$defs` (scope, version, effective dates, §13.2 role vocabulary, IANA/`HH:MM`/ISO 4217 patterns). Not a document schema itself; every kind schema `$ref`s it. |
| `<kind>.schema.json` | One JSON Schema 2020-12 per policy kind (nine kinds, listed below). |
| `defaults/<kind>.default.json` | The seed instance that encodes the decisions confirmed in `plans/DECISIONS.md` section D on 2026-10-07. |
| `../../server/pro-act-backend/test/fixtures/policies.spec.ts` | Validation test: every schema compiles (strict 2020-12 + formats) and every default validates. |

## Document shape

```json
{
  "policyKind": "<kind>",            // const per schema = accounting_policies.policy_kind
  "version": 1,                       // integer >= 1, monotonic per (tenant, site, unit, kind)
  "effectiveFrom": "…Z",              // UTC, half-open [effectiveFrom, effectiveTo)
  "effectiveTo": null,                // null = current
  "scope": { "tenantId": "…", "siteId": null, "unitId": null },
  "notes": "free text, never interpreted",
  "body": { … kind-specific fields … }  // = accounting_policies.body (jsonb)
}
```

- Envelope fields map 1:1 to columns (`tenant_id`, `site_id`, `unit_id`, `policy_kind`, `version`, `effective_from`, `effective_to`); `body` is the JSON column. The body alone can be validated with the sub-schema `<schema $id>#/$defs/body`.
- `additionalProperties: false` everywhere: an unknown field is a validation error, so a typo cannot silently become a no-op.
- **Resolution** at run time: the most specific effective version wins — unit override > site > tenant — per kind. A run never mixes versions of one kind.
- Schema `default` values are documentation of the shipped default; validators run **without** `useDefaults`, so a stored document is always complete and explicit.

## Kinds

| Kind | What it controls | Spec | Decision | Consumed by |
|---|---|---|---|---|
| `reconciliation_tolerance` | Residual tolerance mode (`zero`/`percent`/`absolute`), value, comparison epsilon, whether an explicit `Unaccounted` classification may close a period | ACC09, ACC10 | D06 | **2.8** `submit` gate and `tolerance_adjustment` creation; versions recorded by 2.5 runs |
| `oee_policy` | ISO 22400 interpretation: planned stops inside S reduce A, derate component, micro-stop threshold, ideal-time weighting, max unknown share before KPIs turn provisional, reconciled-OEE tile, stream combination, default ledger view | KPI01, KPI02, KPI04, ACC02 | D04 | **2.5** engine (segment classification), **2.7** KPI engine |
| `coverage_gate` | Required actuals coverage before approval; proportional estimate of boundary-spanning output events; approved substitutions counting as accepted | ACT02, ACT05 | D05 | **2.4** ActualsRunner, **2.8** submit gate |
| `state_rules` | State-engine timing defaults: debounce, micro-stop, restart confirmation, staleness (min seconds and sample factor), outside-schedule monitoring, occurrence gap bridging | DT01–DT04 | D04 | **1.10** state engine (`state_rules` rows override per equipment class/asset) |
| `valuation_basis` | Default monetary basis, time-vs-quantity exclusivity rule, tenant currency, FX policy | VAL01–VAL03 | D08 | **2.6** ValuationService (`valuation_policies` = this kind) |
| `source_authority` | Per measurement (`output`/`state`/`rate`): primary source, fallback source and conditions, cadence, conflict tolerance, override role | SRC01, SRC02, ACT02 | D05 | **1.10** AuthorityService / `source_segments`, **2.4** method selection |
| `approval_roles` | Submit/approve/revise roles, two-approver option, self-approval ban (const `true`), legacy v1 role map | WF02, WF05, §13.2 | D06 | **2.8** lifecycle commands, **0.4** guards and legacy mapping |
| `calendar_defaults` | Timezone, operational-day start, shift templates, accounting leaf (`shift`/`day`), holiday treatment | CAL01, CAL02, §3.1 | D03 | **2.1** seeds the first `calendar_versions` row and is the fallback for units without a published calendar |
| `rca_policy` | RCA trigger thresholds (duration, approved cost, repeated failures in a window) and recommend-vs-create | RCA01, RCA02, KPI07 | D13 | **3.9** RcaTriggerService; 3.8 `rca_trigger_hint` rules default to it |

Cross-kind invariant: `oee_policy.body.microStopSeconds` must equal `state_rules.body.microStopSeconds` for the same scope (DT03/KPI02 classify one stop either as performance or availability, never both). JSON Schema cannot express it; the 2.5 run validator refuses a run whose effective policies disagree.

## Versions and approval

1. **Versioned.** A new or changed policy is a new `version` row; published versions are immutable. `effectiveFrom`/`effectiveTo` are UTC half-open intervals, so a change takes effect at a boundary and history is preserved.
2. **Approved.** Approval (`approved_by`, `approved_at`) lives on the `accounting_policies` row, not in the document; the approver must differ from the author (same separation of duties as periods, WF02). `valuation_basis` additionally requires finance approval before any valuation runs (VAL01: until then lines are `unvalued`, reason `policy_unapproved`).
3. **Recorded on every calculation run.** `calculation_runs.policy_versions` (jsonb, 2.5) stores `{ "<kind>": { "policyId", "version" } }` for every kind the run read, and the approval snapshot (2.8, WF03) copies it. A result can therefore always be explained by the policy text that produced it (FND03, API03).
4. **Changing a policy** triggers `PeriodRecalculateRequested` for periods in its scope and effective range: draft revisions recompute, in-review revisions become stale, approved revisions are never touched — a `period_change_proposals` row shows the before/after and a privileged `revise` applies it (WF04).

## Seed defaults and placeholders

- `defaults/*.default.json` encode the confirmation log of 2026-10-07 (`plans/DECISIONS.md` section D). Each file's `notes` names the decision row and whether a value was answered or derived.
- `scope.tenantId` is the all-zero placeholder `00000000-0000-0000-0000-000000000000`; the seeder (sub-phase 2.x seeders, A4) replaces it with the real tenant id and writes `siteId` once `sites` exist (2.1).
- `effectiveFrom` is the epoch sentinel `1970-01-01T00:00:00Z` so every historical period resolves to version 1; later versions use real dates.
- **Open values needing a decision** (defaults chosen so nothing is fabricated):
  - `valuation_basis.body.currency` = `XXX` (ISO 4217 "no currency") — D08 question 2 unanswered. Valuation stays `unvalued` until set and approved.
  - `rca_policy.body.costThreshold` = `null` — disabled until a currency exists.
  - `oee_policy.body.maxUnknownShare` = `0`, `source_authority.body.conflictTolerance` = `0`, `coverage_gate.body.allowProportionalEstimate` = `true` — derived from the spirit of the recorded answers (100 % coverage, tolerance zero, estimates allowed only when labelled), not explicit answers; confirm at the 2.4/2.7 gates.
  - Only the `output` measurement is seeded for `source_authority`; `state` and `rate` policies are 1.10 commissioning inputs.

## Validating

```bash
cd server/pro-act-backend
npx jest test/fixtures/policies.spec.ts            # when the `fixtures` Jest project is configured
npx jest --rootDir . test/fixtures/policies.spec.ts  # otherwise
```

In the backend use `ajv/dist/2020` with `ajv-formats`, `addSchema(policy-envelope.schema.json)` first, then `compile` each kind schema; validate a stored body with `getSchema('<kind $id>#/$defs/body')`.
