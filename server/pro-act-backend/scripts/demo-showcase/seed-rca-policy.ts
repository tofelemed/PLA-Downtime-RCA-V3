/**
 * DEMO RCA trigger policy of a showcase plant: a tenant-wide `rca_policy` version marked "Demo" in its
 * notes, recorded by a manager before the events are written so the triggers and the approvals of the run
 * evaluate with it. Illustrative values only — never a product default (the product seeds the SME D17
 * pilot without a money limit):
 * - a 3,000 USD money limit so the cost trigger can fire on approved value;
 * - assets of criticality High counted as critical (thresholds halved) — the showcase catalog has no
 *   "Critical" assets;
 * - a 14-day baseline lookback and 120 run hours of minimum exposure so a 30-day showcase can show
 *   effective and not-effective verdicts (the pilot asks for 90 days and 720 run hours).
 */
import { ShowcaseContext } from './showcase-context';

export const DEMO_RCA_POLICY_NOTE =
  'Demo showcase policy (illustrative, not plant data): money limit 3,000 USD, High-criticality assets ' +
  'counted as critical, 14-day baseline and 120 run hours so the 30-day showcase can show effectiveness verdicts';

interface PolicyRow {
  id: string;
  version: number;
  notes: string | null;
  durationThresholdSeconds: number;
  repeatCount: number;
  repeatWindowDays: number;
  autoCreate: 'recommend' | 'create';
  effectiveness: Record<string, unknown>;
}

export async function seedRcaPolicy(ctx: ShowcaseContext): Promise<void> {
  const manager = ctx.as('managers', 0);
  const current = await manager.get<PolicyRow>('/v2/rca-policies/current');
  if (current.notes === DEMO_RCA_POLICY_NOTE) {
    ctx.tally.kept('rca policy (demo)');
    return;
  }
  ctx.tally.add(
    'rca policy (demo)',
    1,
    0,
    'Demo: 3,000 USD money limit, High = critical, short exposure',
  );
  ctx.logger.log(
    '  Demo: recording the illustrative RCA trigger policy version (not a product default)',
  );
  if (ctx.dryRun) return;
  await manager.post(
    '/v2/rca-policies',
    {
      durationThresholdSeconds: current.durationThresholdSeconds,
      repeatCount: current.repeatCount,
      repeatWindowDays: current.repeatWindowDays,
      autoCreate: current.autoCreate,
      costThreshold: 3000,
      costCurrency: 'USD',
      criticalAssets: {
        criticalities: ['critical', 'high'],
        thresholdFactor: 0.5,
      },
      effectiveness: {
        ...current.effectiveness,
        baselineLookbackDays: 14,
        minExposureHours: 120,
      },
      notes: DEMO_RCA_POLICY_NOTE,
    },
    'demo rca policy',
  );
}
