# HDPE plant: reproducible seed and walkthrough

This is a synthetic industrial dataset for testing Traverse Forge. It represents
two HDPE extrusion, pelletizing and finishing trains. Equipment rates, grades,
events, measurements, lab evidence and commercial values are plausible examples,
not measurements or certificates from an operating facility.

## Final hierarchy

The application requires an organization and a plant before units can be created.
The owner's final configuration uses **HDPE** for both names and removes the other
organizations, plants and their child records:

```text
HDPE organization
└── HDPE plant
    ├── unit100
    │   └── Extruder1 (plus its finishing-train equipment)
    └── unit200
        └── Extruder2 (plus its finishing-train equipment)
```

The established internal organization/plant codes remain `demo-org` / `demo-plant`
so existing seed tooling can resolve their stable identities. They are not extra
organizations. The plant is `5f011848-1cb5-4b7c-b75a-8938b46260a9`.

## Engineering assumptions

| Item | unit100 / Extruder1 | unit200 / Extruder2 |
|---|---|---|
| Unit reference capacity | 32 t/h | 28 t/h |
| Grade profile planning rates | 26.5–28.9 t/h | 23.6–25.8 t/h |
| Nominal shift | 8 h | 8 h |
| Operating pattern | Continuous, three shifts | Continuous, three shifts |
| Grade campaigns | PE100 pipe / F7000 film / BL3 blow molding | F7000 film / IM55 injection / BL3 blow molding |
| Demonstration telemetry | 28.8 t/h totalizer increments, digital state | 28 / 21 / 0 / 28 t/h analog rate sequence |

The unit reference capacity is stored on the unit. Each grade profile has its own
sustained rate, generated deterministically from that reference and the seed
`hdpe-petrochemical-2026`. Planning is 92% of the grade's sustained rate, rounded
to 0.1 t/h. The final profile values are:

| Unit | Grade | Sustained, t/h | Planning, t/h |
|---|---|---:|---:|
| unit100 | HDPE-PE100-BK | 28.8 | 26.5 |
| unit100 | HDPE-F7000 | 31.4 | 28.9 |
| unit100 | HDPE-BL3 | 30.2 | 27.8 |
| unit200 | HDPE-F7000 | 28.0 | 25.8 |
| unit200 | HDPE-IM55 | 27.5 | 25.3 |
| unit200 | HDPE-BL3 | 25.6 | 23.6 |

Monthly plan targets use 97% of scheduled grade planning capacity; the current
month includes an independently approved revision. These are planning assumptions,
not guarantees of actual output. The telemetry scenario is separate from these
planning profiles.

Calendar: `Asia/Tehran`, operational day at 06:00, Morning/Afternoon/Night shifts, four
crews, Saturday week start, Gregorian display with Latin digits. The application's
financial month-close workflow uses its existing Solar Hijri calendar; a 60-day
history is seeded so the complete previous financial month can be closed.

| Synthetic grade | Density, g/cm³ | MFR, g/10 min | Condition |
|---|---:|---:|---|
| HDPE PE100 pipe compound, black | 0.959 | 0.25 | 190°C / 5 kg; carbon black 2.25 wt% |
| HDPE film F7000 | 0.952 | 0.05 | 190°C / 2.16 kg |
| HDPE blow molding BL3 | 0.954 | 0.30 | 190°C / 2.16 kg |
| HDPE injection IM55 | 0.955 | 5.5 | 190°C / 2.16 kg |

MFR values with different loads are not directly comparable. The seed does not
claim certification of PE100 pipe performance or any vendor grade specification.

Industrial context comes from [Coperion's polyolefin extrusion equipment](https://www.coperion.com/en/products-services/extruders-compounding-machines/zsk-twin-screw-extruders/zsk-megacompounder)
and [LyondellBasell's HDPE applications](https://www.lyondellbasell.com/en/our-solutions/products/polymers/resin-type/hdpe/).
Representative density/MFR conventions are supported by the manufacturer's
[blow-molding product guide](https://www.lyondellbasell.com/globalassets/sites/2022/plastimagen/olefins--polyolefins/hdpe-and-pp-grades-used-in-blow-molding---consumer-rigid-packaging---product-selection-guide.pdf).
Prices, exchange rates, calibration references and lab certificate IDs in this
dataset are explicitly illustrative.

## Workflows to inspect

| Persona / area | Seeded work |
|---|---|
| Operators | Open stops, uncoded recent events, mechanical/electrical/process reasons, equipment and unit filters |
| Production engineers | Grade campaigns, approved profiles/rates, production plans, shift outputs, transition losses |
| Production accountants | Draft and in-review shifts, rejected reconciliation, measurement adjustments, inventory bridge and prior-loss reversal drafts |
| Managers | Independently approved history, verified historical stops, certified days, quantity close, one delegation |
| Quality / Lab | Approved and proposed lot dispositions, downgrade, scrap, rework and recovery examples |
| Metrology | Approved uncertainty budgets: 0.3 t and 0.4 t independent components, combined 0.5 t, expanded 1.0 t at k=2; separate accountant adoption |
| Finance | Valuation policies/rates, USD/IRR examples, FX, materiality review, finance sign-off and locked previous month |
| Reliability | Failure modes, maintenance history, standby pump, RCA cases/actions/evidence and knowledge entries |
| Integration | MQTT connections, hierarchy mappings, engineering-unit signals, counter/rate previews and ingestion provenance |
| Viewers | The same HDPE records with read-only access |

A late-evidence proposal against a locked period demonstrates controlled reopening;
it does not silently alter published figures. A future **draft** unit100→unit200
off-grade recovery route demonstrates the route editor while leaving the normal
two trains independent. Source-authority approval takes effect when approved;
the custom hierarchy is not claimed to have governed pre-existing historical runs.

The finite MQTT snapshot contains 126 samples for each of three signals (378 total),
one sample per minute. The unit200 rate integral over 125 minutes is 45.5 t. The
unit100 20-minute stop at 28.8 t/h represents 9.6 t. Values are in tonnes or tonnes
per hour, not the unrealistic tonnes-per-second values of a generic stress feed.
The feed naturally becomes stale after its final sample; it is not a continuous
live historian connection.

## Accounts

All 52 named persona accounts use `Persona-2026!demo`. The complete cast and rights
are in [DEMO_PERSONAS.md](DEMO_PERSONAS.md). Useful starting accounts:

| Role | Email |
|---|---|
| SuperAdmin | helena.fischer@demo.acme.com |
| Plant manager | jonas.weber@demo.acme.com |
| Engineer | noah.schmidt@demo.acme.com |
| Operator | liam.murphy@demo.acme.com |
| Unit100-only operator | ingrid.hansen@demo.acme.com |
| Production accountant | sara.nouri@demo.acme.com |
| Quality / Lab | parisa.rahimi@demo.acme.com |
| Metrology | kaveh.ahmadi@demo.acme.com |
| Finance maintainer | mina.sadeghi@demo.acme.com |
| Finance approver | reza.karimi@demo.acme.com |
| Reliability engineer | leila.farouk@demo.acme.com |
| Integration administrator | elena.marchetti@demo.acme.com |
| Master-data administrator | charlotte.evans@demo.acme.com |
| Viewer | grace.whitfield@demo.acme.com |

## Reproduction

The active local stack is frontend `http://localhost:8070`, API
`http://localhost:4004/api`, worker `:4005`, PostgreSQL database `proact` in the
`proact-postgres` container on host port 5432. The bundled `proact-postgres-1` on
5433 is a separate database and is not the seed target. No `.env` files are edited.
For this validation stack, the database is also attached to `proact_default` and
the API/worker use `DEV_DB_HOST=proact-postgres` with the devdb Compose override.
This gives container traffic a direct database route; host scripts still use
`127.0.0.1:5432`. Keep that environment override when recreating the services.

1. Back up `proact` with `pg_dump -Fc` and verify `pg_restore --list` can read it.
   Keep the original and the pre-final-cleanup backups in
   `test-results/hdpe-audit/`. Stop API and worker before the destructive reset.
   After the browser campaign, first retain a backup of its disposable fixtures,
   then restore the audited `hdpe-before-ui.dump` snapshot. The guard intentionally
   refuses arbitrary `P-ADM-*` organizations/plants created by browser tests; do not
   broaden its allowlist to bypass that refusal. This restore/reset sequence is for
   this local test campaign, never an instruction to overwrite unrelated user data.

   Restore this partitioned database by rebuilding its `public` schema inside one
   transaction. The attempted `pg_restore --clean --single-transaction` failed on
   an inherited child-partition primary key and rolled back; it is not the restore
   recipe for this snapshot. With both services stopped, the verified custom dump
   copied to `/tmp/hdpe-final-source.dump` in `proact-postgres`, and the fresh
   post-browser backup retained, run:

   ```powershell
   docker exec proact-postgres pg_restore --file=/tmp/hdpe-final-restore.sql /tmp/hdpe-final-source.dump
   if ($LASTEXITCODE -ne 0) { throw 'Dump expansion failed; do not restore.' }
   @'
   BEGIN;
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public AUTHORIZATION pg_database_owner;
   \i /tmp/hdpe-final-restore.sql
   COMMIT;
   '@ | docker exec -i proact-postgres psql -U postgres -d proact -X -v ON_ERROR_STOP=1
   if ($LASTEXITCODE -ne 0) { throw 'Restore failed and rolled back; keep services stopped.' }
   ```

   Run the transaction in one `psql` session as shown. This full dump recreates the
   extensions, ownership, privileges, constraints and row-security policies; it
   contains no separate schema-create entry. This recipe was reviewed for the
   campaign's database, whose application objects are in `public`. The successful
   `COMMIT` and subsequent reset/bootstrap are recorded in
   `test-results/hdpe-audit/final-cleanup-recovery.log`; the original failed attempt
   remains evidence as well.
2. From `server/pro-act-backend`, run the guarded reset only after confirming the
   backed-up data belongs to this local demonstration:

   ```powershell
   npx ts-node -r tsconfig-paths/register scripts/hdpe-reset.ts --apply --hdpe-only
   npm run db:seed-demo-personas -- --hdpe-only
   ```

   The reset preserves schema/migrations and known demo identities, truncates
   operational parent tables without `CASCADE`, deletes other organizations/plants,
   and rehomes the named cast in HDPE. It refuses unfamiliar identities or a
   nonlocal/non-`proact` database. The required backup is
   `test-results/hdpe-audit/pre-reset-proact.dump`.

   The initial inventory contained **162 parent tables**, of which **155** were
   operational. The final restored schema contained **183 parent tables**, of
   which **176** were operational. These are snapshots at different stages, not
   competing counts of one reset. Compare `original-pre-reset-inventory.json`
   with the final `pre-reset-inventory.json` in the evidence directory; the final
   reset log confirms 183/176. Inherited child partitions are handled through
   their parents and are not counted separately.
3. Start API and worker, wait for healthy API, then run:

   ```powershell
   npm run db:seed-demo-personas -- --hdpe-only --verify
   npm run db:seed-demo-showcase -- --demo-plant --days 60 --seed hdpe-petrochemical-2026 --only master-data,codes
   npm run db:seed-demo-mqtt -- --demo-plant --unit unit100 --broker-url mqtt://host.docker.internal:1884
   $env:DEMO_MQTT_BROKER_URL = 'mqtt://localhost:1884'
   npm run db:seed-demo-showcase -- --demo-plant --days 60 --seed hdpe-petrochemical-2026
   ```

   Persona/world bootstrap is isolated seed SQL; operational records and approvals
   use the public business APIs with separate authors/checkers. MQTT measurements
   enter through the broker and ingestion worker. A partial failed seed is preserved
   for diagnosis; use the supported `--only` / `--skip` step options deliberately
   after fixing its cause. Do not count a printed creation tally as proof of success.
   The bootstrap call also resolves the always-run profile references. The connection
   URL is reachable from the Docker worker; the publisher URL is reachable from the
   host shell. Wait for both MQTT subscription jobs to be running before publishing.
4. From the repository root, run `pwsh -File scripts/hdpe-verify.ps1`. It reads the
   financial calendar boundaries from the API, runs the three read-only SQL audits
   (`hdpe-final-verify`, `hdpe-db-audit`, `hdpe-ingestion-verify`) and compares the
   signal-preview API quantities with independently checked telemetry. It saves
   evidence without saving the login token. The finite snapshot checks are for the
   operational day on which it was seeded; rerun the integration seed on a new day
   only after deliberately managing the old snapshot. Then run the final HDPE-only
   persona and desktop/mobile read-only smoke tests.

The generic persona command without `--hdpe-only` intentionally creates extra plants
for cross-tenant test fixtures. Do not run it against the final single-plant demo.
The old MSSQL `db:delete-all-data` command is not suitable for this PostgreSQL stack.

## Evidence and limits

[HDPE_API_AUDIT.md](HDPE_API_AUDIT.md) separates live request evidence from static
analysis flags. [HDPE_E2E_REPORT.md](HDPE_E2E_REPORT.md) records actual completed test
counts, fixes and remaining limitations. Raw JSON, logs, backups and screenshots
are retained under the ignored `test-results/hdpe-audit/` directory.

The final validated database is saved as `hdpe-final-validated.dump`
(21,052,197 bytes). Its restore listing was checked; a separate full restore of
that final archive was not run. `final-evidence-sha256.json` records its hash and
the hashes of the retained recovery/evidence files. Closing acceptance after the
browser sweep passed in `final-acceptance-post-routes.log`; API, worker and
frontend health is recorded in `final-stack-health.json`.

Unit/integration suites run against their own harness; database integration tests
use `proact_hdpe_test`. Browser workflow tests create disposable fixtures and must
finish before the final cleanup. Final inspection should use read-only checks so
the application remains the requested two-unit plant.
