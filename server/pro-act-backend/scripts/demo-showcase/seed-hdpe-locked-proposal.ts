/** Demo late evidence stays a proposal; locked figures are never silently rewritten. */
import { loadPeriods } from './period-loader';
import { ReconciliationView } from './reconcile-period';
import { ShowcaseContext } from './showcase-context';

interface Month {
  previousMonthKey: string;
  firstDate: string;
  endDate: string;
  state: string;
}

export async function seedHdpeLockedProposal(
  ctx: ShowcaseContext,
): Promise<void> {
  if (ctx.dryRun) return;
  const accountant = ctx.as('accountants', 0);
  const current = await accountant.get<Month>('/v2/month-closes/current');
  const previous = await accountant.get<Month>(
    `/v2/month-closes/${current.previousMonthKey}`,
  );
  if (previous.state !== 'locked')
    throw new Error(
      'Demo previous financial month must be locked before proposing late evidence',
    );
  const unitId = ctx.ids.units.get('EXT1');
  if (!unitId) return;
  const periods = await loadPeriods(
    accountant,
    unitId,
    Date.parse(`${previous.firstDate}T00:00:00Z`),
    Date.parse(`${previous.endDate}T00:00:00Z`),
  );
  const period = periods.find((row) => row.target > 0);
  if (!period)
    throw new Error('Demo locked month has no planned production shift');
  const view = await accountant.get<ReconciliationView>(
    `/v2/production-periods/${period.id}/reconciliation`,
  );
  await accountant.post(
    '/v2/period-change-proposals',
    {
      periodId: period.id,
      approvedRevision: view.revision.revision,
      reason:
        'Demo: late calibrated weighbridge ticket indicates 0.6 t transfer correction; request controlled month reopen and independent review',
      evidenceType: 'measurement_record',
      evidenceRef: 'DEMO-WB-LATE-006',
    },
    `Demo locked month proposal ${period.id}`,
  );
  ctx.tally.created('HDPE locked month correction proposal');
}
