import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MonthClose } from './entities/month-close.entity';

/** How a change reaches an approved period: a direct revise, or an accepted change proposal. */
export type CorrectionPath = 'direct' | 'proposal';

/**
 * Month close commands and corrections of approved periods serialize on one advisory lock per plant:
 * a close takes it exclusively, a revise shared — so a month cannot close while a revise of one of its
 * periods is in flight, and revises never wait on each other.
 */
export async function lockMonthCloses(
  manager: EntityManager,
  tenantId: string,
  mode: 'exclusive' | 'shared',
): Promise<void> {
  const fn =
    mode === 'exclusive'
      ? 'pg_advisory_xact_lock'
      : 'pg_advisory_xact_lock_shared';
  await manager.query(`SELECT ${fn}(hashtext($1))`, [
    `month_close:${tenantId}`,
  ]);
}

/** The month close row whose dates contain an operational date, if the month was ever acted on. */
export function monthCloseOn(
  manager: EntityManager,
  tenantId: string,
  localDate: string,
): Promise<MonthClose | null> {
  return manager
    .getRepository(MonthClose)
    .createQueryBuilder('mc')
    .where('mc.tenantId = :tenantId', { tenantId })
    .andWhere('mc.firstDate <= :localDate AND mc.endDate > :localDate', {
      localDate,
    })
    .getOne();
}

/**
 * SME R4: approved periods of a closing month (quantities closed or finance signed off) do not change —
 * 409 MONTH_CLOSING, reopen the month first; those of a locked month change only through a change
 * proposal (409 MONTH_LOCKED for a direct revise), and the correction is marked `afterClose`.
 */
export async function correctionAllowed(
  manager: EntityManager,
  period: { tenantId: string; localDate: string },
  path: CorrectionPath,
): Promise<{ afterClose: boolean }> {
  await lockMonthCloses(manager, period.tenantId, 'shared');
  const close = await monthCloseOn(manager, period.tenantId, period.localDate);
  if (!close || close.state === 'open') return { afterClose: false };
  if (close.state !== 'locked') {
    throw new ConflictException({
      code: 'MONTH_CLOSING',
      message: `month ${close.monthKey} is ${close.state.replace(/_/g, ' ')}; reopen it before changing its periods`,
    });
  }
  if (path === 'direct') {
    throw new ConflictException({
      code: 'MONTH_LOCKED',
      message: `month ${close.monthKey} is locked; correct the period through a change proposal`,
    });
  }
  return { afterClose: true };
}
