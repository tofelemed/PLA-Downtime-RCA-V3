import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `jalali_month_key(date)`: the Solar Hijri month of a local date as `YYYY-MM` (`1405-07` = Mehr 1405), so
 * reports group a Persian-calendar plant by its own months (settings audit, 21 Oct 2026; before, month
 * buckets were Gregorian on every plant). The arithmetic is the one of `domain/calendar/plant-month.ts` and
 * the frontend (`src/lib/dates/jalali.ts`): Farvardin 1 of year `y` is epoch day
 * `-492268 + 365(y − 1) + ⌊(8y + 21) / 33⌋`; months 1–6 have 31 days, 7–11 have 30.
 */
const FUNCTION_UP = `CREATE FUNCTION jalali_month_key(d date) RETURNS text
  LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  WITH e AS (SELECT (d - DATE '1970-01-01') AS day),
  y AS (
    SELECT e.day, max(c.jy) AS jy
      FROM e, LATERAL generate_series(
             ((e.day + 492268) / 365.2422)::int - 1,
             ((e.day + 492268) / 365.2422)::int + 2) AS c(jy)
     WHERE -492268 + 365 * (c.jy - 1) + (8 * c.jy + 21) / 33 <= e.day
     GROUP BY e.day
  ),
  m AS (
    SELECT y.jy, y.day - (-492268 + 365 * (y.jy - 1) + (8 * y.jy + 21) / 33) AS doy FROM y
  )
  SELECT lpad(m.jy::text, 4, '0') || '-' ||
         lpad((CASE WHEN m.doy < 186 THEN m.doy / 31 + 1 ELSE (m.doy - 186) / 30 + 7 END)::text, 2, '0')
    FROM m
$$`;

export class PlantMonthKeyFunction1794241100000 implements MigrationInterface {
  name = 'PlantMonthKeyFunction1794241100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(FUNCTION_UP);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS jalali_month_key(date)`);
  }
}
