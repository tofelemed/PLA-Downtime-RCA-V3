import { LEGACY_ROLES, mapLegacyRole } from '../auth/roles/role-model';
import { REVISION_APPROVERS } from '../v2/periods/period-roles';
import { BACKLOG_ROLES, LONG_STOP_ROLES } from './downtime-alerts';

/**
 * QA re-test decision 2026-10-19 ("Stale work reminders"): a reminder addressed to the holders of a role is
 * the recipient's work only while they hold that role for the unit. When the recipient lost the role (grant
 * revoked, delegation ended, legacy fallback switched off by an own grant, account deactivated), their open
 * copy is resolved as `superseded`; the other holders' copies stay open, and the producer re-opens it if the
 * role comes back. Covered: uncoded-stop backlog and long open stop (stop coders / long-stop roles), SLA
 * checker reminders (revision approvers) and SLA escalations (the escalation's role). Assignee reminders
 * (actions, tasks) and named-preparer reminders are about the person, not a role, and are left alone.
 */

const sqlText = (value: string) => `'${value.replace(/'/g, "''")}'`;
const textArray = (values: readonly string[]) =>
  `ARRAY[${values.map(sqlText).join(', ')}]::text[]`;

/** D06 legacy role → scope role, as `roleHoldersOf` counts it (only while the user holds no own grant). */
const LEGACY_MAP = `(VALUES ${LEGACY_ROLES.map(
  (legacy) => `(${sqlText(legacy)}, ${sqlText(mapLegacyRole(legacy))})`,
).join(', ')}) AS lm("legacy", "role")`;

/** The roles and unit each role-addressed reminder kind is about (`r` = one open notification). */
const ADDRESSED = `SELECT n2."id", n2."user_id", n2."tenant_id",
       CASE n2."kind"
         WHEN 'uncoded_backlog' THEN n2."entity_id"
         WHEN 'long_open_stop' THEN (SELECT e."unit_id" FROM "production_events" e WHERE e."id" = n2."entity_id")
         ELSE (n2."detail"->>'unitId')::uuid END AS "unit_id",
       CASE n2."kind"
         WHEN 'uncoded_backlog' THEN ${textArray(BACKLOG_ROLES)}
         WHEN 'long_open_stop' THEN ${textArray(LONG_STOP_ROLES)}
         WHEN 'sla_escalation' THEN ARRAY[n2."detail"->>'role']::text[]
         ELSE ${textArray(REVISION_APPROVERS)} END AS "roles"
  FROM "user_notifications" n2
 WHERE n2."tenant_id" = $1 AND n2."resolved_at" IS NULL AND n2."work_item_key" IS NOT NULL
   AND (n2."kind" IN ('uncoded_backlog', 'long_open_stop', 'sla_escalation')
        OR (n2."kind" = 'sla_reminder' AND n2."detail"->>'recipient' = 'checker'))`;

const ON_UNIT = (alias: string) => `(${alias}."scope_kind" = 'tenant'
          OR (${alias}."scope_kind" = 'unit' AND ${alias}."scope_id" = r."unit_id")
          OR (${alias}."scope_kind" = 'site'
              AND ${alias}."scope_id" = (SELECT x."site_id" FROM "units" x WHERE x."id" = r."unit_id")))`;

/** Same holder rule as `roleHoldersOf` (role-holders.ts): own grant, legacy fallback or a delegation in force. */
const STILL_HOLDS = `EXISTS (SELECT 1 FROM "users" u WHERE u."id" = r."user_id" AND u."is_active" IS DISTINCT FROM false
   AND (EXISTS (SELECT 1 FROM "user_scopes" s
                 WHERE s."user_id" = u."id" AND s."tenant_id" = r."tenant_id" AND s."role" = ANY(r."roles")
                   AND ${ON_UNIT('s')})
        OR (u."tenant_id" = r."tenant_id"
            AND u."role" IN (SELECT lm."legacy" FROM ${LEGACY_MAP} WHERE lm."role" = ANY(r."roles") AND lm."legacy" <> lm."role")
            AND NOT EXISTS (SELECT 1 FROM "user_scopes" own WHERE own."user_id" = u."id" AND own."tenant_id" = r."tenant_id"))
        OR EXISTS (SELECT 1 FROM "role_delegations" d
                    WHERE d."delegate_id" = u."id" AND d."tenant_id" = r."tenant_id" AND d."role" = ANY(r."roles")
                      AND d."revoked_at" IS NULL AND d."valid_from" <= $2 AND d."valid_until" > $2
                      AND ${ON_UNIT('d')})))`;

/** Open role-addressed reminders of plant `$1` whose recipient no longer holds the role at `$2`. */
export const ROLE_LOST_SELECT = `SELECT r."id", r."user_id" FROM (${ADDRESSED}) r
 WHERE r."unit_id" IS NOT NULL AND NOT ${STILL_HOLDS}`;

export const ROLE_LOST = `UPDATE "user_notifications" n
    SET "resolved_at" = $2, "updated_at" = $2, "row_version" = n."row_version" + 1, "resolution" = 'superseded'
  FROM (${ROLE_LOST_SELECT}) lost
 WHERE n."id" = lost."id" AND n."resolved_at" IS NULL
 RETURNING n."id"`;
