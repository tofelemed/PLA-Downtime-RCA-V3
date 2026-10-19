/**
 * Set-based resolution of shared work-item notifications (owner 18 Oct). Each statement updates every open
 * notification of one plant (`$1`) whose work is done, for every recipient at once, at `$2`; it reads only
 * open rows (`IDX_user_notifications_open_work`) and checks each work item with one indexed probe — no
 * per-row round trips. Each returns the ids it resolved.
 */

const OPEN = `n."tenant_id" = $1 AND n."resolved_at" IS NULL AND n."work_item_key" IS NOT NULL`;
const RESOLVE = `"resolved_at" = $2, "updated_at" = $2, "row_version" = n."row_version" + 1`;

/** Same class filter as the reminder producers (`downtime-alerts.ts`). */
const UNPLANNED_STOP = `e."physical_type" = 'downtime' AND e."schedule_class" IN ('unplanned', 'unknown')`;

/**
 * `uncoded_backlog`: resolved once the unit and production day has no closed uncoded unplanned stop left
 * (coded, marked for investigation, reclassified or retracted). The day of a stop is the day of the unit's
 * period holding its start, else its start date in plant time — as the producer groups it.
 */
const UNCODED_BACKLOG = `UPDATE "user_notifications" n SET ${RESOLVE}, "resolution" = 'completed'
 WHERE ${OPEN} AND n."kind" = 'uncoded_backlog' AND n."detail" ? 'localDate'
   AND NOT EXISTS (
     SELECT 1 FROM "production_events" e
       JOIN "tenants" t ON t."id" = e."tenant_id"
       LEFT JOIN LATERAL (SELECT p."local_date" FROM "production_periods" p
                           WHERE p."tenant_id" = e."tenant_id" AND p."unit_id" = e."unit_id"
                             AND p."utc_start" <= e."start_time" AND p."utc_end" > e."start_time"
                           ORDER BY p."utc_start" DESC LIMIT 1) pd ON true
      WHERE e."tenant_id" = n."tenant_id" AND e."unit_id" = n."entity_id"
        AND e."coding_state" = 'uncoded' AND e."physical_state" = 'closed' AND ${UNPLANNED_STOP}
        AND e."start_time" >= ((n."detail"->>'localDate')::date - 2)::timestamptz
        AND e."start_time" < ((n."detail"->>'localDate')::date + 3)::timestamptz
        AND coalesce(pd."local_date", (e."start_time" AT TIME ZONE coalesce(t."timezone", 'UTC'))::date)
            = (n."detail"->>'localDate')::date)
 RETURNING n."id"`;

/** `long_open_stop`: resolved once the stop ended, was reclassified as planned or is gone. */
const LONG_OPEN_STOP = `UPDATE "user_notifications" n SET ${RESOLVE}, "resolution" = 'completed'
 WHERE ${OPEN} AND n."kind" = 'long_open_stop'
   AND NOT EXISTS (
     SELECT 1 FROM "production_events" e
      WHERE e."id" = n."entity_id" AND e."tenant_id" = n."tenant_id"
        AND e."end_time" IS NULL AND e."physical_state" = 'open' AND ${UNPLANNED_STOP})
 RETURNING n."id"`;

/**
 * Due / overdue reminders of corrective actions and tasks: resolved once the item is no longer open for the
 * reminded due date — `completed` when it is done, cancelled or deleted, `superseded` when it is still open
 * under a new due date (its new reminders follow).
 */
function workItemSql(input: {
  kinds: string;
  table: string;
  open: string;
}): string {
  const item = `x."id" = n."entity_id" AND x."tenant_id" = n."tenant_id" AND ${input.open}`;
  return `UPDATE "user_notifications" n SET ${RESOLVE},
       "resolution" = CASE WHEN EXISTS (SELECT 1 FROM "${input.table}" x WHERE ${item})
                           THEN 'superseded' ELSE 'completed' END
 WHERE ${OPEN} AND n."kind" IN (${input.kinds}) AND n."detail" ? 'dueAt'
   AND NOT EXISTS (SELECT 1 FROM "${input.table}" x
                    WHERE ${item} AND x."due_date" = (n."detail"->>'dueAt')::timestamptz)
 RETURNING n."id"`;
}

const RCA_ACTIONS = workItemSql({
  kinds: `'rca_action_due', 'rca_action_overdue'`,
  table: 'rca_actions',
  open: `x."status" IN ('open', 'in_progress')`,
});

const TASKS = workItemSql({
  kinds: `'task_due', 'task_overdue'`,
  table: 'tasks',
  open: `x."status" NOT IN ('Completed', 'Cancelled')`,
});

/**
 * SLA reminders and escalations of a period (SME R3 / R6): every one is resolved when the period's current
 * revision is approved. A due reminder is also resolved when its stage and submission cycle are no longer
 * the current one (submitted, decided, rejected or revised — the next cycle reminds anew); a rejection
 * escalation when its revision is no longer the current one.
 */
const SLA = `UPDATE "user_notifications" n SET ${RESOLVE}, "resolution" = 'completed'
  FROM (SELECT n2."id", r."lifecycle"::text AS "lifecycle",
               'sla:' || n2."entity_id" || ':due:'
                 || CASE WHEN r."lifecycle"::text = 'in_review' THEN 'approve' ELSE 'submit' END
                 || ':' || coalesce(r."id"::text, 'none') || ':' || coalesce(rj."rejections", 0) AS "due_key",
               'sla:' || n2."entity_id" || ':rejection:' || coalesce(r."id"::text, 'none') AS "rejection_key"
          FROM "user_notifications" n2
          LEFT JOIN LATERAL (SELECT ar."id", ar."lifecycle" FROM "accounting_revisions" ar
                              WHERE ar."period_id" = n2."entity_id" AND ar."lifecycle" <> 'cancelled'
                              ORDER BY ar."revision" DESC LIMIT 1) r ON true
          LEFT JOIN LATERAL (SELECT count(*)::int AS "rejections" FROM "approval_actions" a
                              WHERE a."revision_id" = r."id" AND a."action" = 'reject') rj ON true
         WHERE n2."tenant_id" = $1 AND n2."resolved_at" IS NULL AND n2."work_item_key" IS NOT NULL
           AND n2."kind" IN ('sla_reminder', 'sla_escalation')) s
 WHERE n."id" = s."id" AND ${OPEN}
   AND (s."lifecycle" = 'approved'
        OR (n."kind" = 'sla_reminder' AND n."work_item_key" <> s."due_key")
        OR (n."work_item_key" LIKE 'sla:%:rejection:%' AND n."work_item_key" <> s."rejection_key"))
 RETURNING n."id"`;

/**
 * `uncoded_backlog` still owed (O2, owner manual test): the notification of an open work item states the work
 * as it is now, not as it was at alert time. After the resolutions, every open backlog notification whose
 * unit and production day still has closed uncoded unplanned stops gets the current count, uncoded seconds,
 * oldest end and message (same day rule as `UNCODED_BACKLOG`), for every recipient at once. Only changed
 * counts / durations are written; the read state, level and alert time (`created_at`, the list order) are kept.
 */
const REFRESH_UNCODED_BACKLOG = `UPDATE "user_notifications" n
    SET "detail" = n."detail" || jsonb_build_object(
          'stops', c."stops", 'uncodedSeconds', c."uncoded_seconds",
          'oldestEndedAt', to_char(c."oldest_end" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
          'message', c."stops" || CASE WHEN c."stops" = 1 THEN ' uncoded stop' ELSE ' uncoded stops' END || ' waiting for a reason',
          'countedAt', to_char($2::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
        "updated_at" = $2, "row_version" = n."row_version" + 1
   FROM (SELECT n2."id", agg."stops", agg."uncoded_seconds", agg."oldest_end"
           FROM "user_notifications" n2
           CROSS JOIN LATERAL (
             SELECT count(*)::int AS "stops",
                    round(sum(extract(epoch FROM e."end_time" - e."start_time")))::int AS "uncoded_seconds",
                    min(e."end_time") AS "oldest_end"
               FROM "production_events" e
               JOIN "tenants" t ON t."id" = e."tenant_id"
               LEFT JOIN LATERAL (SELECT p."local_date" FROM "production_periods" p
                                   WHERE p."tenant_id" = e."tenant_id" AND p."unit_id" = e."unit_id"
                                     AND p."utc_start" <= e."start_time" AND p."utc_end" > e."start_time"
                                   ORDER BY p."utc_start" DESC LIMIT 1) pd ON true
              WHERE e."tenant_id" = n2."tenant_id" AND e."unit_id" = n2."entity_id"
                AND e."coding_state" = 'uncoded' AND e."physical_state" = 'closed' AND ${UNPLANNED_STOP}
                AND e."start_time" >= ((n2."detail"->>'localDate')::date - 2)::timestamptz
                AND e."start_time" < ((n2."detail"->>'localDate')::date + 3)::timestamptz
                AND coalesce(pd."local_date", (e."start_time" AT TIME ZONE coalesce(t."timezone", 'UTC'))::date)
                    = (n2."detail"->>'localDate')::date) agg
          WHERE n2."tenant_id" = $1 AND n2."resolved_at" IS NULL AND n2."work_item_key" IS NOT NULL
            AND n2."kind" = 'uncoded_backlog' AND n2."detail" ? 'localDate') c
  WHERE n."id" = c."id" AND c."stops" > 0
    AND ((n."detail"->>'stops') IS DISTINCT FROM c."stops"::text
         OR (n."detail"->>'uncodedSeconds') IS DISTINCT FROM c."uncoded_seconds"::text)
 RETURNING n."id"`;

/** Open work-item notifications whose text follows the work still owed (run after the resolutions). */
export const REFRESH_STATEMENTS: readonly string[] = [REFRESH_UNCODED_BACKLOG];

export const RESOLUTION_STATEMENTS: readonly string[] = [
  UNCODED_BACKLOG,
  LONG_OPEN_STOP,
  RCA_ACTIONS,
  TASKS,
  SLA,
];
