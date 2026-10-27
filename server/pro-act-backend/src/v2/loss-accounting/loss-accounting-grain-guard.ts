import { UnprocessableEntityException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { CalendarVersion } from '../../calendar/entities/calendar-version.entity';
import { AccountingPolicy } from '../../periods/entities/accounting-policy.entity';
import {
  LossAccountingPolicy,
  parseLossAccounting,
} from '../../periods/loss-accounting-policy';
import { DAILY_CALENDAR_MARKER } from './loss-accounting-switch';
import { LossAccountingInForce } from './loss-accounting-v2.service';

/** The unit a version's daily calendar is scoped to (its accounting unit, else its own unit); null = the site. */
const scopeOf = (body: LossAccountingPolicy, unitId: string | null) =>
  body.accountingUnitId ?? unitId;

/** This path's daily calendar (marker) of the scope, published and open-ended: in force or pending. */
async function markedDailyCalendar(
  manager: EntityManager,
  tenantId: string,
  scopeUnitId: string | null,
): Promise<boolean> {
  const found = await manager.count(CalendarVersion, {
    where: {
      tenantId,
      unitId: scopeUnitId ?? IsNull(),
      state: 'published',
      republishReason: DAILY_CALENDAR_MARKER,
      effectiveTo: IsNull(),
    },
  });
  return found > 0;
}

/**
 * Follow-up of the day-grain switch: a plant already on daily accounting (the in-force version is per day
 * and its marked daily calendar is in force or pending) cannot go back to shifts, move its day start or
 * move to another accounting unit yet — the switch only adds a daily calendar, it cannot undo one.
 * 422 GRAIN_CHANGE_UNSUPPORTED; settings-only versions (basis, target, product, tolerance) pass.
 */
export async function assertSupportedGrainChange(
  manager: EntityManager,
  draft: AccountingPolicy,
  base: LossAccountingInForce,
): Promise<void> {
  if (base.body.grain !== 'day') return;
  const scope = scopeOf(base.body, base.row.unitId);
  if (!(await markedDailyCalendar(manager, draft.tenantId, scope))) return;
  const next = parseLossAccounting(draft.body);
  const unchanged =
    next.grain === 'day' &&
    next.dayStart === base.body.dayStart &&
    scopeOf(next, draft.unitId) === scope;
  if (unchanged) return;
  throw new UnprocessableEntityException({
    code: 'GRAIN_CHANGE_UNSUPPORTED',
    message:
      'Changing the grain, day start or accounting unit of a plant already on daily accounting is not supported yet',
  });
}
