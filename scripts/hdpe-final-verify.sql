-- Read-only acceptance checks for the owner's final one-organization HDPE seed.
-- Obtain exact calendar boundaries from authenticated GET /v2/month-closes/current
-- and GET /v2/month-closes/{previousMonthKey}; do not approximate Solar Hijri months.
-- Invoke psql with -v hdpe_current_month_first_date=YYYY-MM-DD
--   -v hdpe_current_month_end_date=YYYY-MM-DD
--   -v hdpe_previous_month_first_date=YYYY-MM-DD -f scripts/hdpe-final-verify.sql
\set ON_ERROR_STOP on
\pset pager off
\if :{?hdpe_current_month_first_date}
\else
  \echo 'Required: -v hdpe_current_month_first_date from the month-closes API'
  \quit 3
\endif
\if :{?hdpe_current_month_end_date}
\else
  \echo 'Required: -v hdpe_current_month_end_date from the month-closes API'
  \quit 3
\endif
\if :{?hdpe_previous_month_first_date}
\else
  \echo 'Required: -v hdpe_previous_month_first_date from the month-closes API'
  \quit 3
\endif
BEGIN READ ONLY;
SELECT set_config('hdpe.verify.current_first', :'hdpe_current_month_first_date', true),
       set_config('hdpe.verify.current_end', :'hdpe_current_month_end_date', true),
       set_config('hdpe.verify.previous_first', :'hdpe_previous_month_first_date', true);
DO $$
DECLARE
  plant uuid;
  org uuid;
  unit100 uuid;
  current_first date := current_setting('hdpe.verify.current_first')::date;
  current_end date := current_setting('hdpe.verify.current_end')::date;
  previous_first date := current_setting('hdpe.verify.previous_first')::date;
  operational_date date := (now() AT TIME ZONE 'Asia/Tehran' - interval '6 hours')::date;
  scoped record;
  violations bigint;
BEGIN
  IF current_database() <> 'proact' THEN RAISE EXCEPTION 'Expected local proact'; END IF;
  SELECT id, organization_id INTO STRICT plant, org FROM tenants WHERE code='demo-plant' AND name='HDPE';
  IF (SELECT count(*) FROM organizations) <> 1 OR NOT EXISTS (SELECT 1 FROM organizations WHERE id=org AND name='HDPE')
    THEN RAISE EXCEPTION 'Expected exactly one HDPE organization'; END IF;
  IF (SELECT count(*) FROM tenants) <> 1 THEN RAISE EXCEPTION 'Expected exactly one HDPE plant'; END IF;
  IF (SELECT array_agg(code ORDER BY code) FROM units) IS DISTINCT FROM ARRAY['unit100','unit200']::varchar[]
    THEN RAISE EXCEPTION 'Expected exactly unit100 and unit200'; END IF;
  IF (SELECT count(*) FROM units WHERE unit_of_measure='t/h' AND ((code='unit100' AND capacity=32) OR (code='unit200' AND capacity=28))) <> 2
    THEN RAISE EXCEPTION 'HDPE capacities or engineering units incorrect'; END IF;
  SELECT id INTO STRICT unit100 FROM units WHERE code='unit100';
  IF EXISTS (SELECT 1 FROM (VALUES ('unit100','Extruder1'),('unit200','Extruder2')) expected(unit_code,asset_name)
      WHERE (SELECT count(*) FROM assets a JOIN units u ON a.unit_id=u.id::text
        WHERE u.code=expected.unit_code AND a.name=expected.asset_name) <> 1)
    THEN RAISE EXCEPTION 'Extruder placement incorrect'; END IF;
  IF EXISTS (SELECT 1 FROM assets a LEFT JOIN units u ON a.unit_id=u.id::text
    WHERE u.id IS NULL OR a.tenant_id IS DISTINCT FROM plant OR a.organization_id IS DISTINCT FROM org::text)
    THEN RAISE EXCEPTION 'Equipment has a missing unit or incorrect HDPE ownership'; END IF;
  IF (SELECT count(*) FROM users WHERE email LIKE '%@demo.acme.com') <> 52
    THEN RAISE EXCEPTION 'Expected 52 named personas'; END IF;
  IF EXISTS (SELECT 1 FROM users u WHERE u.email LIKE '%@demo.acme.com'
    AND (NOT u.is_active OR u.tenant_id IS DISTINCT FROM plant OR u.organization_id IS DISTINCT FROM org
      OR NOT EXISTS (SELECT 1 FROM user_scopes s WHERE s.user_id=u.id)))
    THEN RAISE EXCEPTION 'Persona inactive, without a grant, or outside HDPE'; END IF;
  IF (SELECT count(*) FROM user_scopes) <> 70 THEN RAISE EXCEPTION 'Expected 70 persona scope grants'; END IF;
  IF EXISTS (SELECT 1 FROM user_scopes s JOIN users u ON u.id=s.user_id
    WHERE u.email NOT LIKE '%@demo.acme.com' OR s.tenant_id IS DISTINCT FROM plant
      OR NOT ((s.scope_kind='tenant' AND s.scope_id=plant)
        OR (s.scope_kind='unit' AND s.scope_id=unit100 AND s.role='operator'
          AND u.email IN ('ingrid.hansen@demo.acme.com','amir.rahimi@demo.acme.com'))))
    THEN RAISE EXCEPTION 'Unexpected scope kind, target, owner, or unit grant'; END IF;
  IF (SELECT count(*) FROM users u WHERE u.email IN ('ingrid.hansen@demo.acme.com','amir.rahimi@demo.acme.com')
    AND u.role='Operator' AND (SELECT count(*) FROM user_scopes s WHERE s.user_id=u.id)=1
    AND EXISTS (SELECT 1 FROM user_scopes s WHERE s.user_id=u.id AND s.scope_kind='unit'
      AND s.scope_id=unit100 AND s.role='operator')) <> 2
    THEN RAISE EXCEPTION 'Ingrid and Amir must each have only the unit100 operator grant'; END IF;
  IF (SELECT count(*) FROM products) <> 4 OR (SELECT count(*) FROM assets) <> 23
    THEN RAISE EXCEPTION 'Expected four HDPE grades and 23 equipment assets'; END IF;
  IF (SELECT count(*) FROM production_profiles WHERE state='approved' AND quantity_uom='t' AND rate_timebase='h'
      AND created_by IS NOT NULL AND approved_by IS NOT NULL AND created_by<>approved_by) <> 6
    THEN RAISE EXCEPTION 'Expected six independently approved tonne/hour grade profiles'; END IF;
  IF (SELECT count(*) FROM (VALUES
      ('unit100','HDPE-PE100-BK',28.8,26.5), ('unit100','HDPE-F7000',31.4,28.9), ('unit100','HDPE-BL3',30.2,27.8),
      ('unit200','HDPE-F7000',28.0,25.8), ('unit200','HDPE-IM55',27.5,25.3), ('unit200','HDPE-BL3',25.6,23.6)
    ) expected(unit_code,product_code,sustained,planning)
    JOIN units u ON u.code=expected.unit_code JOIN products p ON p.code=expected.product_code
    JOIN production_profiles f ON f.unit_id=u.id AND f.product_id=p.id AND f.state='approved'
    JOIN unit_product_rates s ON s.profile_id=f.id AND s.rate_kind='sustained' AND s.state='approved' AND s.effective_to IS NULL
    JOIN unit_product_rates r ON r.profile_id=f.id AND r.rate_kind='planning' AND r.state='approved' AND r.effective_to IS NULL
    WHERE s.rate=expected.sustained AND r.rate=expected.planning AND s.timebase='h' AND r.timebase='h'
      AND s.created_by IS NOT NULL AND s.approved_by IS NOT NULL AND s.created_by<>s.approved_by
      AND r.created_by IS NOT NULL AND r.approved_by IS NOT NULL AND r.created_by<>r.approved_by) <> 6
    THEN RAISE EXCEPTION 'Grade sustained/planning rates or independent approval differ from the documented scenario'; END IF;
  IF (SELECT count(*) FROM users WHERE role='viewer') <> 4
    THEN RAISE EXCEPTION 'Expected four read-only viewers'; END IF;
  IF (SELECT count(*) FROM users u WHERE u.email IN ('grace.whitfield@demo.acme.com','pedro.santos@demo.acme.com',
      'nadia.petrova@demo.acme.com','kenji.nakamura@demo.acme.com') AND u.role='viewer'
    AND (SELECT count(*) FROM user_scopes s WHERE s.user_id=u.id)=1
    AND EXISTS (SELECT 1 FROM user_scopes s WHERE s.user_id=u.id AND s.role='viewer'
      AND s.scope_kind='tenant' AND s.scope_id=plant)) <> 4
    THEN RAISE EXCEPTION 'Each named viewer must have exactly one HDPE viewer grant'; END IF;
  FOR scoped IN
    SELECT a.attname AS column_name, c.relname AS table_name
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition
      AND a.attname IN ('tenant_id','organization_id','tenantId','organizationId') AND NOT a.attisdropped
  LOOP
    EXECUTE format('SELECT count(*) FROM %I WHERE %I IS NOT NULL AND %I::text<>$1', scoped.table_name, scoped.column_name, scoped.column_name)
      INTO violations USING CASE WHEN scoped.column_name IN ('tenant_id','tenantId') THEN plant::text ELSE org::text END;
    IF violations<>0 THEN RAISE EXCEPTION '% foreign scope values in %.%', violations, scoped.table_name, scoped.column_name; END IF;
  END LOOP;
  IF (SELECT count(*) FROM accounting_revisions WHERE lifecycle='approved') < 300
    THEN RAISE EXCEPTION 'Historical approval population incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM production_periods p
    WHERE NOT p.is_excluded AND p.selected_plan_version_id IS NOT NULL
      AND p.local_date < ((now() AT TIME ZONE 'Asia/Tehran' - interval '6 hours')::date - 3)
      AND NOT EXISTS (SELECT 1 FROM accounting_revisions r WHERE r.period_id=p.id AND r.lifecycle='approved'))
    THEN RAISE EXCEPTION 'An eligible historical shift has no published approval'; END IF;
  IF EXISTS (SELECT 1 FROM accounting_revisions WHERE lifecycle='approved'
    AND (submitted_by IS NULL OR approved_by IS NULL OR submitted_by=approved_by
      OR submitted_at IS NULL OR approved_at IS NULL OR submitted_hash IS NULL))
    THEN RAISE EXCEPTION 'Approved revision lacks independent recorded submission/approval'; END IF;
  IF EXISTS (SELECT 1 FROM accounting_revisions r LEFT JOIN approval_snapshots a ON a.id=r.approval_snapshot_id
    WHERE r.lifecycle='approved' AND (a.id IS NULL OR a.revision_id IS DISTINCT FROM r.id
      OR a.period_id IS DISTINCT FROM r.period_id OR a.tenant_id IS DISTINCT FROM r.tenant_id
      OR a.submitted_hash IS DISTINCT FROM r.submitted_hash
      OR CASE WHEN jsonb_typeof(a.content->'reviewed'->'slices')='array'
        THEN jsonb_array_length(a.content->'reviewed'->'slices')=0 ELSE true END))
    THEN RAISE EXCEPTION 'An approved revision lacks its matching snapshot and nonempty slice array'; END IF;
  IF EXISTS (SELECT 1 FROM accounting_revisions r JOIN approval_snapshots a ON a.id=r.approval_snapshot_id,
    LATERAL jsonb_array_elements(a.content->'reviewed'->'slices') s
    WHERE r.lifecycle='approved' AND ((s->>'gap') IS NULL OR (s->>'attributed') IS NULL
      OR (s->>'toleranceAdjustment') IS NULL OR (s->>'residual') IS NULL
      OR (s->>'target') IS NULL OR (s->>'actual') IS NULL))
    THEN RAISE EXCEPTION 'Published slice has missing/null balance quantities'; END IF;
  IF EXISTS (SELECT 1 FROM accounting_revisions r JOIN approval_snapshots a ON a.id=r.approval_snapshot_id,
    LATERAL jsonb_array_elements(a.content->'reviewed'->'slices') s
    WHERE r.lifecycle='approved' AND (
      abs((s->>'target')::numeric-(s->>'actual')::numeric-(s->>'gap')::numeric)>0.000001
      OR abs((s->>'gap')::numeric-(s->>'attributed')::numeric-(s->>'toleranceAdjustment')::numeric-(s->>'residual')::numeric)>0.000001
      OR abs((s->>'residual')::numeric)>0.000001))
    THEN RAISE EXCEPTION 'Published balance does not close'; END IF;
  IF NOT (previous_first<current_first AND current_first<=operational_date AND operational_date<current_end)
    THEN RAISE EXCEPTION 'Month boundary parameters do not contain the current operational day'; END IF;
  IF NOT EXISTS (SELECT 1 FROM month_closes WHERE tenant_id=plant
    AND first_date=previous_first AND end_date=current_first AND state='locked'
    AND quantities_closed_by IS NOT NULL AND finance_signed_off_by IS NOT NULL
    AND quantities_closed_by<>finance_signed_off_by AND locked_by IS NOT NULL
    AND quantities_closed_at IS NOT NULL AND finance_signed_off_at IS NOT NULL AND locked_at IS NOT NULL
    AND (NOT materiality_required OR (materiality_reviewed_by IS NOT NULL AND materiality_reviewed_at IS NOT NULL)))
    THEN RAISE EXCEPTION 'Previous month not independently closed and locked'; END IF;
  -- MonthClose is created by the first command; an absent current row is legitimately open.
  IF EXISTS (SELECT 1 FROM month_closes WHERE tenant_id=plant AND first_date<current_end AND end_date>current_first
    AND (first_date<>current_first OR end_date<>current_end OR state<>'open'))
    THEN RAISE EXCEPTION 'Current financial month is not open or has inconsistent boundaries'; END IF;
  IF NOT EXISTS (SELECT 1 FROM period_change_proposals cp
    JOIN production_periods p ON p.id=cp.period_id
    JOIN accounting_revisions r ON r.id=cp.approved_revision_id AND r.period_id=p.id
    JOIN month_closes m ON m.tenant_id=p.tenant_id AND p.local_date>=m.first_date AND p.local_date<m.end_date
    WHERE cp.tenant_id=plant AND cp.unit_id=unit100 AND p.unit_id=unit100
      AND cp.trigger='manual_correction' AND cp.state='open' AND cp.created_revision_id IS NULL
      AND cp.detail->'manual'->>'evidenceType'='measurement_record'
      AND cp.detail->'manual'->>'evidenceRef'='DEMO-WB-LATE-006'
      AND r.lifecycle='approved' AND m.state='locked' AND m.first_date=previous_first AND m.end_date=current_first
      AND NOT EXISTS (SELECT 1 FROM accounting_revisions newer WHERE newer.period_id=p.id AND newer.revision>r.revision))
    THEN RAISE EXCEPTION 'Locked-month late evidence proposal missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM reconciliation_lines l JOIN accounting_revisions r ON r.current_line_set_id=l.line_set_id
    WHERE r.lifecycle='draft' AND l.kind='bridge' AND l.quantity=2)
    THEN RAISE EXCEPTION 'Inventory bridge draft missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM reconciliation_lines l JOIN accounting_revisions r ON r.current_line_set_id=l.line_set_id
    WHERE r.lifecycle='draft' AND l.kind='reversal' AND l.quantity=-0.5 AND l.reverses_line_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Prior-loss reversal draft missing'; END IF;
  IF (SELECT count(*) FROM uncertainty_budgets WHERE state='approved' AND combined_standard_uncertainty=0.5 AND expanded_uncertainty=1) <> 2
    THEN RAISE EXCEPTION 'Approved uncertainty budgets missing'; END IF;
  IF (SELECT count(*) FROM measurement_samples) <> 378
    THEN RAISE EXCEPTION 'Expected 378 ingested engineering-unit samples'; END IF;
  IF EXISTS (SELECT 1 FROM measurement_samples WHERE quality<>'good')
    THEN RAISE EXCEPTION 'Unexpected sample quality'; END IF;
  RAISE NOTICE 'All final HDPE acceptance invariants passed';
END $$;

SELECT 'organizations' AS entity, count(*) FROM organizations
UNION ALL SELECT 'plants',count(*) FROM tenants
UNION ALL SELECT 'units',count(*) FROM units
UNION ALL SELECT 'assets',count(*) FROM assets
UNION ALL SELECT 'products',count(*) FROM products
UNION ALL SELECT 'persona_users',count(*) FROM users WHERE email LIKE '%@demo.acme.com'
UNION ALL SELECT 'scopes',count(*) FROM user_scopes
UNION ALL SELECT 'events',count(*) FROM production_events
UNION ALL SELECT 'production_periods',count(*) FROM production_periods
UNION ALL SELECT 'approved_revisions',count(*) FROM accounting_revisions WHERE lifecycle='approved'
UNION ALL SELECT 'dispositions',count(*) FROM lot_dispositions
UNION ALL SELECT 'measurement_samples',count(*) FROM measurement_samples
UNION ALL SELECT 'rcas',count(*) FROM rcas;
SELECT month_key,first_date,end_date,state,materiality_required,materiality_reviewed_at FROM month_closes ORDER BY first_date;
SELECT u.code AS unit,p.code AS grade,r.rate_kind,r.rate,f.quantity_uom,r.timebase
FROM unit_product_rates r JOIN production_profiles f ON f.id=r.profile_id JOIN units u ON u.id=f.unit_id
JOIN products p ON p.id=f.product_id WHERE r.rate_kind IN ('sustained','planning') ORDER BY u.code,p.code,r.rate_kind;
SELECT s.name,s.canonical_uom,count(*) AS samples,min(m.value),max(m.value),min(m.observed_at),max(m.observed_at)
FROM measurement_samples m JOIN signals s ON s.id=m.signal_id GROUP BY s.id,s.name,s.canonical_uom ORDER BY s.name;
ROLLBACK;
