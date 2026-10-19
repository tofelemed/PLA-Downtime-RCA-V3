import { EntityManager } from 'typeorm';
import { planCoveredSql } from '../../close/plan-coverage-sql';
import { params, SHOWN } from './report-sql';
import { ReportScope } from './report-scope';

/**
 * Owner decisions 2026-10-19 (QA P-0, re-test "No approved plan covers this period"): the period-level
 * groups of a report (`TIME_GROUPS` keys) whose every period no approved plan covers, so a report row
 * of such a day says so once instead of "Not available" per figure. Information only: no figure changes.
 */
export async function uncoveredGroupKeys(
  manager: EntityManager,
  scope: ReportScope,
  groupSql: string,
): Promise<Set<string | null>> {
  const rows: Array<{ group_key: string | null }> = await manager.query(
    `${SHOWN}
     SELECT ${groupSql} AS "group_key"
       FROM shown s JOIN "production_periods" p ON p."id" = s."period_id"
      GROUP BY 1
     HAVING bool_and(NOT ${planCoveredSql('p')})`,
    params(scope),
  );
  return new Set(rows.map((row) => row.group_key));
}
