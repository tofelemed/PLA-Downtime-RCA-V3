# Phase 0 — Verify, decide, found

**Spec epics:** P0 E01 Baseline and policy · P0 E02 Contracts and tenancy
**Exit gate (spec §20):** evidence matrix recorded; D01–D07 assigned; UUID scope, v2 DTOs, permissions, validation and compound queries live; **T13 and T14 pass**; **B1 B2 B14 B17 B18 confirmed resolved**.
**Milestone:** M0 Verified baseline.

Nothing in Phase 1+ starts before 0.3 (environment/migrations) and 0.4 (API foundation) are done, because every later sub-phase writes migrations and v2 routes.

| Status | Sub-phase | Depends on | Exit tests |
|---|---|---|---|
| ✅ | [0.1 Baseline audit and evidence matrix](0.1-baseline-audit.md) | — | Evidence committed in `913086b`; fixtures authored; all three test suites recorded |
| ✅ | [0.2 Decision register and proposed policies](0.2-decision-register.md) | — (parallel with 0.1) | D01–D15 recorded; policy schemas + defaults validated |
| 🧪 | [0.3 Dev environment, migrations, worker, CI](0.3-dev-environment-and-migrations.md) | 0.1 | Verified locally 8 Oct; GitHub CI run, fresh-clone check, lint-gate decision open ([evidence](../evidence/phase0-verification.md)) |
| 🧪 | [0.4 API v2 foundation](0.4-api-v2-foundation.md) | 0.3 | Parts 1 + 2 implemented; T13/T14 core green locally; GitHub CI run open |

## Why Phase 0 is not optional

The spec (§1, §2.2, §18.1) refuses to credit any capability from S1 until it is verified against the checkout with tests. S1 is our own gap analysis, so most findings are already verified, but the spec wants the evidence *recorded*: commit ID, route inventory, schema, test run, demonstration. 0.1 produces that record once, and later sub-phases link to it instead of re-arguing what exists.

## Deliverables at the end of Phase 0

- `plans/evidence/` — baseline commit, route inventory, schema dump, test results, S1 finding verification table (confirmed / resolved / absent / changed).
- `test/fixtures/` — machine-readable fixtures for T01–T46 with expected results (JSON), consumed by later unit tests.
- TypeORM migration workflow replacing `DB_SYNCHRONIZE`; initial migration capturing the current schema.
- `worker` bootstrap and Compose services for Kafka and worker.
- `/api/v2` module skeleton with tenancy resolution, global guards, query DTO, cursor pagination, error envelope, idempotency store.
- Bugs B1 B2 B14 B17 B18 fixed in the existing v1 controllers (they are also fixed by design in v2).
