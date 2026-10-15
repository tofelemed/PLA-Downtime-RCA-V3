-- Read-only HDPE integrity and representative filtered-query audit. Run after the final seed.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM production_events e JOIN units u ON u.id=e.unit_id WHERE e.tenant_id::text<>u.tenant_id::text)
    OR EXISTS (SELECT 1 FROM production_periods p JOIN units u ON u.id=p.unit_id WHERE p.tenant_id<>u.tenant_id)
    OR EXISTS (SELECT 1 FROM pg_constraint WHERE NOT convalidated)
    OR EXISTS (SELECT 1 FROM accounting_revisions WHERE lifecycle='approved' AND submitted_by=approved_by)
    OR EXISTS (SELECT 1 FROM production_periods a JOIN production_periods b
      ON a.tenant_id=b.tenant_id AND a.unit_id=b.unit_id AND a.id<b.id
      AND tstzrange(a.utc_start,a.utc_end,'[)') && tstzrange(b.utc_start,b.utc_end,'[)'))
    THEN RAISE EXCEPTION 'Tenant, database constraint, approval or period overlap integrity failed';
  END IF;
END $$;
SELECT id AS plant_id FROM tenants WHERE code = 'demo-plant' \gset
SELECT id AS unit_id FROM units WHERE tenant_id = :'plant_id' AND code = 'unit100' \gset

SELECT 'hierarchy' AS audit, t.name AS plant, u.code, a.name AS extruder, u.capacity, u.unit_of_measure
FROM tenants t JOIN units u ON u.tenant_id = t.id JOIN assets a ON a.unit_id = u.id::text
WHERE t.id = :'plant_id' AND a.name IN ('Extruder1', 'Extruder2') ORDER BY u.code;

SELECT 'events_cross_tenant_unit' AS audit, count(*) AS violations
FROM production_events e JOIN units u ON u.id = e.unit_id WHERE e.tenant_id::text <> u.tenant_id::text
UNION ALL SELECT 'periods_cross_tenant_unit', count(*)
FROM production_periods p JOIN units u ON u.id = p.unit_id WHERE p.tenant_id <> u.tenant_id
UNION ALL SELECT 'invalid_database_constraints', count(*) FROM pg_constraint WHERE NOT convalidated
UNION ALL SELECT 'self_approved_shifts', count(*) FROM accounting_revisions
WHERE lifecycle = 'approved' AND submitted_by = approved_by
UNION ALL SELECT 'overlapping_periods', count(*) FROM production_periods a JOIN production_periods b
ON a.tenant_id=b.tenant_id AND a.unit_id=b.unit_id AND a.id<b.id
AND tstzrange(a.utc_start,a.utc_end,'[)') && tstzrange(b.utc_start,b.utc_end,'[)');

SELECT 'published_plan_balance' AS audit, count(*) AS slices,
 count(*) FILTER (WHERE abs((s->>'gap')::numeric-(s->>'attributed')::numeric
   -coalesce((s->>'toleranceAdjustment')::numeric,0)-(s->>'residual')::numeric)>0.000001) AS inconsistent_slices,
 count(*) FILTER (WHERE abs((s->>'residual')::numeric)>0.000001) AS nonzero_residual_slices
FROM approval_snapshots a JOIN accounting_revisions r ON r.id=a.revision_id,
LATERAL jsonb_array_elements(a.content->'reviewed'->'slices') s
WHERE a.tenant_id=:'plant_id' AND r.lifecycle='approved';

SELECT r.lifecycle, count(*) FROM accounting_revisions r WHERE tenant_id=:'plant_id' GROUP BY r.lifecycle ORDER BY r.lifecycle;
SELECT physical_type, coding_state, count(*), count(verified_at) AS supervisor_verified,
 count(validated_at) AS maintenance_validated FROM production_events WHERE tenant_id=:'plant_id'
GROUP BY physical_type,coding_state ORDER BY physical_type,coding_state;

-- Representative Event Hub window with a unit filter and keyset ordering.
EXPLAIN (ANALYZE, BUFFERS)
SELECT e.id,e.start_time,e.physical_type,e.reason_code_id FROM production_events e
WHERE e.tenant_id=:'plant_id' AND e.unit_id=:'unit_id'
AND tstzrange(e.start_time,e.end_time,'[)') && tstzrange(now()-interval '7 days',now(),'[)')
ORDER BY e.start_time DESC,e.id DESC LIMIT 50;

-- Shift grid and current revision, bounded to a calendar month.
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id,p.utc_start,r.lifecycle FROM production_periods p
LEFT JOIN LATERAL (SELECT lifecycle FROM accounting_revisions r WHERE r.period_id=p.id ORDER BY revision DESC LIMIT 1) r ON true
WHERE p.tenant_id=:'plant_id' AND p.unit_id=:'unit_id' AND p.utc_start>=now()-interval '31 days'
ORDER BY p.utc_start DESC,p.id DESC LIMIT 50;

-- Published ledger by loss category for the two-train plant.
EXPLAIN (ANALYZE, BUFFERS)
SELECT l.kind,sum(l.quantity) FROM approved_loss_lines l
JOIN accounting_revisions r ON r.id=l.revision_id AND r.lifecycle='approved'
JOIN production_periods p ON p.id=l.period_id
WHERE l.tenant_id=:'plant_id' AND p.utc_start>=now()-interval '60 days'
GROUP BY l.kind;

-- The telemetry reader's tenant / signal / observed-time path and partition pruning.
SELECT signal_id AS signal_id FROM measurement_samples WHERE tenant_id=:'plant_id' ORDER BY observed_at DESC LIMIT 1 \gset
EXPLAIN (ANALYZE, BUFFERS)
SELECT observed_at,value,quality FROM measurement_samples
WHERE tenant_id=:'plant_id' AND signal_id=:'signal_id' AND observed_at>=now()-interval '1 day'
ORDER BY observed_at LIMIT 500;
ROLLBACK;
