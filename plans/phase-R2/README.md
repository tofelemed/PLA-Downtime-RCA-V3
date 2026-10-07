# Phase R2 — Extended ecosystem (spec §1.2, §5.4, §10.1, AN04, E13)

**Status:** ⬜ not started · **Gate:** R1 stable in production, agreed business demand, separate acceptance plan (spec §20 E13).

R1 must already provide the extension points these need: the adapter interface (1.5), the canonical envelope, `external_production_reports` (2.4), domain events and delivery adapters (2.9), `kpi_results` and `failure_events` (2.7), `rca_actions` (3.9).

| Candidate sub-phase | Spec | Builds on | Notes |
|---|---|---|---|
| R2.1 OPC UA edge adapter | §5.4 (node ids, source timestamps, status codes, reconnect gaps via edge collector) | 1.5 adapter interface, 1.10 state engine | Existing `opcua-client.service.ts` (node-opcua) is a starting library wrapper; must go through normalization/tenancy, never bypass |
| R2.2 REST and file/database imports | §5.4 (idempotency keys, schema versions, dry-run, manifests; least-privilege DB reads, stable pagination, incremental keys/CDC) | 1.5, 2.4 | Daily production CSV/JSON import generalized |
| R2.3 CMMS / Maximo exchange | §10.1 ACT08, RCA02 work orders, D12 | 2.4 external reports, 2.9 delivery adapters, 3.9 links | Replace stub with authenticated API/event delivery; status mapping policy; stock adjustments as separate input |
| R2.4 Production reliability studies | AN04 (normalized daily series, documented exclusions, demonstrated performance comparison, optional Weibull with sample size, fit method, goodness of fit, uncertainty) | 2.7, 2.4 | Kept separate from approved totals; β thresholds are reference interpretations only |
| R2.5 Advanced causality assistance | RCA03 (AI suggestions attributed, human-accepted), `docs/microserviceSpecs.md` knowledge-graph vision | 3.9, 1.10 occurrences | Recommendations only; never asserts proven root cause |
| R2.6 Cross-site improvement tracking | AN03 cross-site comparisons, RCA03 learning feedback | 2.7 aggregation, 3.9 actions | Shows tz/unit/mode/product/policy/coverage/baseline differences |
| R2.7 Service extraction (only if measured need) | §20 last paragraph | — | Reconsider extraction when scaling, deployment independence or team ownership justify it |

Each candidate gets its own sub-phase file with the standard sections when it is scheduled.
