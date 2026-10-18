/**
 * The one definition of an overdue RCA action (the `GET /v2/rcas/summary` count, the RCA list's action
 * counts and the cross-case action list): an open or in-progress action whose due date has passed.
 * `alias` is the SQL alias of `rca_actions`.
 */
export const actionOverdueSql = (alias: string): string =>
  `(${alias}."due_date" IS NOT NULL AND ${alias}."due_date" < now() AND ${alias}."status"::text IN ('open', 'in_progress'))`;
