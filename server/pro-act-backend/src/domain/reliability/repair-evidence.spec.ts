import { Dec } from '../actuals/decimal';
import { reliability } from '../kpi/reliability';
import { repairEvidence, RepairOperation } from './repair-evidence';

const H = 3_600_000;
const T0 = Date.UTC(2026, 9, 14, 0);
const t = (hours: number) => new Date(T0 + hours * H);

const op = (
  kind: RepairOperation['kind'],
  from: number,
  to: number | null,
  waitingHours = 0,
): RepairOperation => ({
  kind,
  start: t(from),
  end: to === null ? null : t(to),
  waitingSeconds: waitingHours * 3600,
});

describe('active repair evidence (SME D10)', () => {
  it('worked example: work 10:00–13:00 is 3 h active repair', () => {
    const evidence = repairEvidence([
      op('diagnosis', 10, 11),
      op('repair', 11, 12.5),
      op('test', 12.5, 13),
    ]);
    expect(evidence).toEqual({
      repairStart: t(10),
      repairEnd: t(13),
      activeRepairSeconds: 3 * 3600,
    });
  });

  it('waiting for parts is not active repair; overlapping crafts count once; other work is ignored', () => {
    const evidence = repairEvidence([
      op('repair', 10, 14, 1.5),
      op('repair', 11, 12),
      op('other', 8, 9),
    ]);
    expect(evidence?.activeRepairSeconds).toBe(2.5 * 3600);
  });

  it('an open operation leaves the repair censored; no active operation is no evidence', () => {
    expect(repairEvidence([op('repair', 10, null)])).toBeNull();
    expect(repairEvidence([op('other', 10, 11)])).toBeNull();
  });

  it('the KPI uses the active seconds: mean active repair 3 h vs mean time to restore production 6 h', () => {
    const results = reliability({
      window: { start: t(0), end: t(24) },
      asOf: t(24),
      exposure: new Dec(18 * 3600),
      microStopSeconds: 60,
      failures: [
        {
          occurrenceId: 'o1',
          assetId: 'pump',
          start: t(8),
          end: t(14),
          source: 'unplanned_stop_with_failure_code',
          repairStart: t(10),
          repairEnd: t(13),
          activeRepairSeconds: 3 * 3600,
        },
      ],
    });
    const unit = (metric: string) =>
      results.find((r) => r.metric === metric && r.scope.level === 'period');
    expect(unit('mttr')?.value?.toNumber()).toBe(3 * 3600);
    expect(unit('mttr')?.cohort).toMatchObject({
      label: 'mean active repair time',
    });
    expect(unit('mean_downtime_to_restore')?.value?.toNumber()).toBe(6 * 3600);
  });
});
