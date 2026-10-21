/**
 * The one definition of an overdue RCA action (the `GET /v2/rcas/summary` count, the RCA list's action
 * counts, the cross-case action list, the R10 tracker): an open or in-progress action whose due plant day is
 * over. `due_date` stores the instant the due plant day starts, so the day ends 24 h later (settings audit,
 * 21 Oct 2026: before, an action showed as overdue on its own due day). `alias` is the SQL alias of
 * `rca_actions`.
 */
export const actionOverdueSql = (alias: string): string =>
  `(${alias}."due_date" IS NOT NULL AND ${alias}."due_date" + interval '1 day' <= now() AND ${alias}."status"::text IN ('open', 'in_progress'))`;
