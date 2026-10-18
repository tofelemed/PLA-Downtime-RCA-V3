/**
 * UX G-2(b): plan-ledger loss lines whose cause is one event ($2), per period, read from what the engine and
 * the approval stored — never recomputed. Per period of a unit in scope ($4, null = every unit), at most
 * $5 periods by start:
 * - `approved`: the published (latest approved) revision's approved lines (VA-01b, decided quantities);
 *   for revisions approved before those were stored, the active plan lines of the approved run;
 * - `provisional`: the open (draft / in review) revision's current run, as proposed by the engine.
 * Loss kinds only ($3). Uses IDX_loss_lines_tenant_cause_event, IDX_approved_loss_lines_tenant_cause and
 * UQ_accounting_revisions_period_revision.
 */
const ATTRIBUTED = `
  WITH touched AS (
    SELECT l."period_id" FROM "loss_lines" l WHERE l."tenant_id" = $1 AND l."cause_event_id" = $2
    UNION
    SELECT a."period_id" FROM "approved_loss_lines" a WHERE a."tenant_id" = $1 AND a."cause_event_id" = $2),
  periods AS (
    SELECT p."id", p."unit_id", p."local_date", p."shift_name", p."utc_start", p."utc_end",
           p."selected_plan_version_id", pv."plan_id",
           (SELECT ar."id" FROM "accounting_revisions" ar WHERE ar."tenant_id" = $1 AND ar."period_id" = p."id"
               AND ar."lifecycle" = 'approved' ORDER BY ar."revision" DESC LIMIT 1) AS "published_id",
           (SELECT ar."id" FROM "accounting_revisions" ar WHERE ar."tenant_id" = $1 AND ar."period_id" = p."id"
               AND ar."lifecycle" IN ('draft', 'in_review') ORDER BY ar."revision" DESC LIMIT 1) AS "open_id"
      FROM touched t
      JOIN "production_periods" p ON p."id" = t."period_id" AND p."tenant_id" = $1
      LEFT JOIN "plan_versions" pv ON pv."id" = p."selected_plan_version_id"
     WHERE ($4::uuid[] IS NULL OR p."unit_id" = ANY($4::uuid[]))
     ORDER BY p."utc_start", p."id"
     LIMIT $5),
  run_lines AS (
    SELECT l."id", l."period_id", l."run_id", l."kind"::text AS "kind", l."uom", l."quantity"
      FROM "loss_lines" l
     WHERE l."tenant_id" = $1 AND l."cause_event_id" = $2 AND l."ledger" = 'plan' AND l."state" = 'active'
       AND l."source" <> 'candidate_superseded' AND l."kind"::text = ANY($3::text[])),
  attributed AS (
    SELECT a."id", 'approved'::text AS "origin", 'approved'::text AS "status", a."period_id", a."revision_id",
           a."kind"::text AS "kind", a."uom", a."quantity"
      FROM periods p JOIN "approved_loss_lines" a ON a."revision_id" = p."published_id"
     WHERE a."tenant_id" = $1 AND a."cause_event_id" = $2 AND a."kind"::text = ANY($3::text[])
    UNION ALL
    SELECT r."id", 'run', 'approved', r."period_id", ar."id", r."kind", r."uom", r."quantity"
      FROM periods p JOIN "accounting_revisions" ar ON ar."id" = p."published_id"
      JOIN run_lines r ON r."run_id" = ar."current_run_id"
     WHERE NOT EXISTS (SELECT 1 FROM "approved_loss_lines" x WHERE x."revision_id" = ar."id")
    UNION ALL
    SELECT r."id", 'run', 'provisional', r."period_id", ar."id", r."kind", r."uom", r."quantity"
      FROM periods p JOIN "accounting_revisions" ar ON ar."id" = p."open_id"
      JOIN run_lines r ON r."run_id" = ar."current_run_id")`;

/** Quantities per period, revision, kind and unit of measure, with the period and revision identity. */
export const ATTRIBUTED_QUANTITIES_SQL = `${ATTRIBUTED}
  SELECT t."period_id", p."unit_id", to_char(p."local_date", 'YYYY-MM-DD') AS "local_date", p."shift_name",
         p."utc_start", p."utc_end", p."selected_plan_version_id" AS "plan_version_id", p."plan_id",
         t."revision_id", ar."revision", ar."lifecycle"::text AS "lifecycle", t."status", t."kind", t."uom",
         sum(t."quantity")::text AS "quantity", count(*)::int AS "lines"
    FROM attributed t
    JOIN periods p ON p."id" = t."period_id"
    JOIN "accounting_revisions" ar ON ar."id" = t."revision_id"
   GROUP BY t."period_id", p."unit_id", p."local_date", p."shift_name", p."utc_start", p."utc_end",
            p."selected_plan_version_id", p."plan_id", t."revision_id", ar."revision", ar."lifecycle", t."status",
            t."kind", t."uom"
   ORDER BY p."utc_start", t."period_id", t."status", t."kind", t."uom"`;

/**
 * Value of one valuation view ($6) per period, revision and currency — the status semantics of the RCA
 * approved impact: the amount is null when any line is unvalued or lacks an FX rate (never estimated, D08).
 */
export const ATTRIBUTED_VALUES_SQL = `${ATTRIBUTED}
  SELECT t."period_id", t."revision_id", v."currency",
         CASE WHEN bool_and(v."status" = 'valued' AND v."amount" IS NOT NULL) THEN sum(v."amount")::text END AS "amount",
         count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL)::int AS "valued",
         count(*) FILTER (WHERE NOT (v."status" = 'valued' AND v."amount" IS NOT NULL))::int AS "unvalued",
         count(*) FILTER (WHERE v."status" = 'valued' AND v."amount" IS NOT NULL AND v."provisional")::int AS "provisional"
    FROM attributed t
    JOIN LATERAL (
      SELECT lv."currency", lv."amount", lv."status"::text AS "status", lv."provisional" FROM "loss_line_valuations" lv
       WHERE t."origin" = 'run' AND lv."tenant_id" = $1 AND lv."loss_line_id" = t."id" AND lv."view" = $6::valuation_view
      UNION ALL
      SELECT av."currency", av."amount", av."status", av."provisional" FROM "approved_loss_line_valuations" av
       WHERE t."origin" = 'approved' AND av."tenant_id" = $1 AND av."approved_line_id" = t."id"
         AND av."view" = $6::valuation_view
    ) v ON true
   GROUP BY t."period_id", t."revision_id", v."currency"
   ORDER BY t."period_id", t."revision_id", v."currency"`;
