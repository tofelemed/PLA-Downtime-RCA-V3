\timing off
\echo '### Q1 outbox relay anti-join probe (F03)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT 1 FROM outbox earlier WHERE earlier.tenant_id='<uuid>' AND earlier.aggregate_type='production_period_window' AND earlier.aggregate_id='<uuid>' AND earlier.state='pending' AND earlier.id < 9223372036854775807 AND earlier.next_attempt_at > now();
\echo '### Q2 state-engine NEW_SAMPLES_SQL (F04)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT min(s.observed_at), max(s.inserted_at) FROM measurement_samples s WHERE s.tenant_id='<uuid>' AND s.signal_id='<uuid>' AND s.inserted_at > now() - interval '10 minutes' AND s.observed_at >= now() - interval '7 days';
\echo '### Q3 actuals_jobs last completed recompute (F04)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT max(j.finished_at) FROM actuals_jobs j WHERE j.period_id='<uuid>' AND j.kind='recompute' AND j.state='completed';
\echo '### Q4 outbox retention batch select (F15)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT id FROM outbox WHERE state='published' AND published_at < now() - interval '90 days' AND NOT (type = ANY('{RevisionApproved}'::text[])) ORDER BY id LIMIT 1000;
\echo '### Q5 inbox retention batch select (F15)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT delivery_key FROM inbox WHERE processed_at IS NOT NULL AND processed_at < now() - interval '90 days' LIMIT 1000;
\echo '### Q6 approved_loss_lines NOT EXISTS by revision, hit (F11)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT NOT EXISTS (SELECT 1 FROM approved_loss_lines x WHERE x.revision_id='<uuid>');
\echo '### Q7 approved_loss_lines NOT EXISTS by revision, miss (F11)'
EXPLAIN (ANALYZE, BUFFERS, COSTS OFF) SELECT NOT EXISTS (SELECT 1 FROM approved_loss_lines x WHERE x.revision_id='<uuid>');
