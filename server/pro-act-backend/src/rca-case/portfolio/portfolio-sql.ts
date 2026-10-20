import { actionOverdueSql } from '../action-overdue';

/**
 * Rows of the loss → cause → action → outcome portfolio (item 2.1), one statement per page:
 * - `cases`: cases of the tenant opened in [$2, $3) (`created_at`), of the units `$4` (null = every unit;
 *   a tenant-wide case needs a tenant-wide caller, `unit_id = ANY` is false for it);
 * - `coded`: each case with each distinct catalogue code of its causes of kind `$5`;
 * - `member`: those pairs plus the cases without such a code (the "Uncoded" row, code null);
 * - grouped per code with its cases, ordered by cases (desc), coded before uncoded, code, then the row key;
 *   keyset on (−cases, sort key, row key) after the cursor (`$6`–`$8`), `$9` rows.
 */
export const PORTFOLIO_ROWS_SQL = `
  WITH cases AS (
    SELECT r."id" FROM "rcas" r
     WHERE r."tenant_id" = $1 AND r."created_at" >= $2 AND r."created_at" < $3
       AND ($4::uuid[] IS NULL OR r."unit_id" = ANY($4::uuid[]))),
  coded AS (
    SELECT DISTINCT c."rca_id", c."cause_code_id"
      FROM "rca_causes" c JOIN cases k ON k."id" = c."rca_id"
     WHERE c."tenant_id" = $1 AND c."kind" = $5 AND c."cause_code_id" IS NOT NULL),
  member AS (
    SELECT "rca_id", "cause_code_id" FROM coded
    UNION ALL
    SELECT k."id", NULL::uuid FROM cases k WHERE NOT EXISTS (SELECT 1 FROM coded x WHERE x."rca_id" = k."id")),
  grouped AS (
    SELECT m."cause_code_id", cc."code", cc."name", cc."is_active",
           count(*)::int AS "cases", array_agg(m."rca_id" ORDER BY m."rca_id") AS "rca_ids",
           CASE WHEN m."cause_code_id" IS NULL THEN '1' ELSE '0' || cc."code" END AS "sort_key",
           COALESCE(m."cause_code_id"::text, 'uncoded') AS "row_key"
      FROM member m LEFT JOIN "rca_cause_codes" cc ON cc."id" = m."cause_code_id"
     GROUP BY m."cause_code_id", cc."code", cc."name", cc."is_active")
  SELECT g.* FROM grouped g
   WHERE $6::int IS NULL OR (-g."cases", g."sort_key", g."row_key") > (-$6::int, $7::text, $8::text)
   ORDER BY g."cases" DESC, g."sort_key", g."row_key"
   LIMIT $9`;

/** Title, status and opening time of the cases of a page. */
export const PORTFOLIO_CASES_SQL = `
  SELECT r."id", r."title", r."status", r."created_at"
    FROM "rcas" r WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[])`;

/** The actions of the cases of a page (claims as decimal text: `numeric` would be parsed to a number). */
export const PORTFOLIO_ACTIONS_SQL = `
  SELECT a."rca_id", a."status"::text AS "status", ${actionOverdueSql('a')} AS "overdue",
         a."claimed_avoided_loss"::text AS "claimed", a."claimed_currency",
         a."post_action" -> 'effectiveness' ->> 'verdict' AS "verdict",
         a."post_action" -> 'realized' ->> 'metric' AS "realized_metric",
         a."post_action" -> 'realized' ->> 'difference' AS "realized_difference",
         a."post_action" ->> 'evaluatedAt' AS "evaluated_at"
    FROM "rca_actions" a WHERE a."tenant_id" = $1 AND a."rca_id" = ANY($2::uuid[])`;

/** Event and loss-line links of the cases of a page. */
export const PORTFOLIO_LINKS_SQL = `
  SELECT "rca_id", "link_type"::text AS "link_type", "target_id" FROM "rca_case_links"
   WHERE "tenant_id" = $1 AND "rca_id" = ANY($2::uuid[]) AND "link_type" IN ('event', 'loss_line')`;
