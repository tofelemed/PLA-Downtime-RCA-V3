-- Independent read-back of the finite HDPE MQTT snapshot and its provenance.
\set ON_ERROR_STOP on
\pset pager off
BEGIN READ ONLY;
DO $$
DECLARE
  expected record;
  signal uuid;
  measured numeric;
  snapshot_start timestamptz := (((now() AT TIME ZONE 'Asia/Tehran' - interval '6 hours')::date + time '06:00') AT TIME ZONE 'Asia/Tehran');
BEGIN
  IF current_database()<>'proact' THEN RAISE EXCEPTION 'Expected local proact'; END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('F1DPwebid-throughput','unit100','counter','t'),
    ('F1DPwebid-runstate','unit100','state',NULL),
    ('DEMO-HDPE-unit200-pellet-rate','unit200','rate','t/h')
  ) AS e(source_key,unit_code,semantic_type,uom)
  LOOP
    SELECT s.id INTO STRICT signal FROM signals s JOIN units u ON u.id=s.unit_id
      WHERE s.source_key=expected.source_key AND u.code=expected.unit_code
        AND s.semantic_type::text=expected.semantic_type AND s.canonical_uom IS NOT DISTINCT FROM expected.uom;
    IF (SELECT count(*) FROM measurement_samples WHERE signal_id=signal)<>126
      THEN RAISE EXCEPTION 'Expected 126 samples for %',expected.source_key; END IF;
    IF (SELECT min(observed_at)<>snapshot_start OR max(observed_at)<>snapshot_start+interval '125 minutes'
      FROM measurement_samples WHERE signal_id=signal)
      THEN RAISE EXCEPTION 'Unexpected snapshot boundaries for %',expected.source_key; END IF;
    IF EXISTS (SELECT 1 FROM (SELECT observed_at,lead(observed_at) OVER (ORDER BY observed_at) AS next_at
      FROM measurement_samples WHERE signal_id=signal) samples
      WHERE next_at IS NOT NULL AND next_at-observed_at<>interval '1 minute')
      THEN RAISE EXCEPTION 'Non-minute cadence for %',expected.source_key; END IF;
  END LOOP;
  IF (SELECT count(*) FROM measurement_samples)<>378 OR EXISTS (
    SELECT 1 FROM measurement_samples m LEFT JOIN raw_observations r ON r.id=m.raw_id AND r.received_at=m.raw_received_at
    WHERE m.quality<>'good' OR r.id IS NULL)
    THEN RAISE EXCEPTION 'Unexpected sample count, quality, or missing raw provenance'; END IF;
  SELECT max(m.value)-min(m.value) INTO measured FROM measurement_samples m JOIN signals s ON s.id=m.signal_id
    WHERE s.source_key='F1DPwebid-throughput';
  IF measured IS DISTINCT FROM 50.4 THEN RAISE EXCEPTION 'Counter delta expected 50.4 t, got %',measured; END IF;
  IF EXISTS (SELECT 1 FROM (SELECT m.value,lag(m.value) OVER (ORDER BY m.observed_at) AS previous
    FROM measurement_samples m JOIN signals s ON s.id=m.signal_id WHERE s.source_key='F1DPwebid-throughput') counter
    WHERE value IS NULL OR (previous IS NOT NULL AND value-previous NOT IN (0,0.48)))
    THEN RAISE EXCEPTION 'Counter reset or nonphysical increment'; END IF;
  -- Sum rate-seconds before converting to hours; per-row division introduces
  -- repeating-decimal rounding even though the complete integral is exact.
  SELECT sum(value*extract(epoch FROM (next_at-observed_at)))/3600 INTO measured FROM (
    SELECT m.value,m.observed_at,lead(m.observed_at) OVER (ORDER BY m.observed_at) AS next_at
    FROM measurement_samples m JOIN signals s ON s.id=m.signal_id WHERE s.source_key='DEMO-HDPE-unit200-pellet-rate'
  ) rate;
  IF measured IS DISTINCT FROM 45.5 THEN RAISE EXCEPTION 'Step rate integral expected 45.5 t, got %',measured; END IF;
  SELECT sum(extract(epoch FROM (next_at-observed_at))) INTO measured FROM (
    SELECT m.state_name,m.observed_at,lead(m.observed_at) OVER (ORDER BY m.observed_at) AS next_at
    FROM measurement_samples m JOIN signals s ON s.id=m.signal_id WHERE s.source_key='F1DPwebid-runstate'
  ) digital WHERE state_name='STOP';
  IF measured IS DISTINCT FROM 1200 THEN RAISE EXCEPTION 'Digital stop expected 1200 s, got %',measured; END IF;
  IF EXISTS (SELECT 1 FROM measurement_samples m JOIN signals s ON s.id=m.signal_id
    WHERE s.source_key='F1DPwebid-runstate' AND (m.state_name IS DISTINCT FROM
      CASE WHEN m.observed_at>=snapshot_start+interval '60 minutes' AND m.observed_at<snapshot_start+interval '80 minutes' THEN 'STOP' ELSE 'RUN' END))
    THEN RAISE EXCEPTION 'Digital stop is outside the intended 20-minute interval'; END IF;
  IF NOT EXISTS (SELECT 1 FROM source_objects so JOIN production_events e ON e.id=so.canonical_event_id
    JOIN integration_connections c ON c.id=so.connection_id
    JOIN units u ON u.id=e.unit_id JOIN reason_codes reason ON reason.id=e.reason_code_id
    WHERE so.source_object_id='Extruder1:DEMO-MQTT-HDPE-' || to_char(snapshot_start AT TIME ZONE 'Asia/Tehran','YYYY-MM-DD')
      AND so.normalized_raw_id=so.latest_raw_id
      AND so.state='active' AND u.code='unit100' AND e.source_kind='source' AND c.source_type='mqtt'
      AND e.start_time=snapshot_start+interval '60 minutes' AND e.end_time=snapshot_start+interval '80 minutes'
      AND e.end_time-e.start_time=interval '20 minutes' AND e.quantity=9.6 AND e.quantity_uom='t'
      AND reason.code='MECH-DIE')
    THEN RAISE EXCEPTION 'Normalized 20-minute MQTT stop with 9.6 t and MECH-DIE is missing'; END IF;
  IF EXISTS (SELECT 1 FROM (VALUES ('Demo: MQTT events (simulator)'),('Demo: MQTT measurements (simulator)')) expected_connection(name)
    WHERE (SELECT count(*) FROM ingestion_jobs j JOIN integration_connections c ON c.id=j.connection_id
    WHERE c.display_name=expected_connection.name
      AND j.state='running' AND j.health->>'connected'='true' AND j.lease_expiry>now()
      AND j.health->>'persistFailed' IS NULL AND j.health->>'parkedReason' IS NULL)<>1)
    THEN RAISE EXCEPTION 'Expected two connected and leased MQTT subscriber jobs'; END IF;
  IF NOT EXISTS (SELECT 1 FROM ingestion_exceptions q JOIN integration_connections c ON c.id=q.connection_id
    WHERE c.display_name='Demo: MQTT events (simulator)' AND q.error_code='not_json' AND q.state='open'
      AND q.source_object_id='proact/v1/HDPE/Polymer/Line1/Extruder1/events')
    THEN RAISE EXCEPTION 'Malformed demonstration message was not quarantined'; END IF;
  RAISE NOTICE 'HDPE ingestion quantities, cadence, event, raw provenance and subscriber health passed';
END $$;
SELECT s.name,s.semantic_type,s.canonical_uom,count(*),min(m.observed_at),max(m.observed_at),min(m.value),max(m.value)
FROM measurement_samples m JOIN signals s ON s.id=m.signal_id GROUP BY s.id ORDER BY s.name;
SELECT c.display_name,j.state,j.heartbeat_at,j.health FROM ingestion_jobs j JOIN integration_connections c ON c.id=j.connection_id ORDER BY c.display_name;
SELECT q.error_code,q.state,q.occurrences FROM ingestion_exceptions q ORDER BY q.error_code;
ROLLBACK;
