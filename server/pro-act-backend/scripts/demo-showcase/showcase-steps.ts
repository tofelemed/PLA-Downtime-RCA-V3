/**
 * The ordered steps of a showcase run. The reference steps (master data, codes, profiles) always run —
 * they only read when everything exists — because later steps need their ids; `--only` / `--skip` select
 * among the others.
 */
import { seedAccounting } from './seed-accounting';
import { seedCalendars } from './seed-calendar';
import { seedCodeLibraries } from './seed-codes';
import { seedDispositions } from './seed-dispositions';
import { seedIntegration } from './seed-integration';
import { recalculate, seedEvents } from './seed-events';
import { closeStaleStops, seedOpenStops } from './seed-open-stops';
import { seedMasterData } from './seed-master-data';
import { seedPartnerEvents } from './seed-partner';
import { seedPlans } from './seed-plans';
import { seedValuationPolicy } from './seed-policy';
import { seedProfiles } from './seed-profiles';
import { seedRcaCases } from './seed-rca';
import { seedRcaFailureStops } from './seed-rca-events';
import { seedRcaPolicy } from './seed-rca-policy';
import { seedReliabilityRecords } from './seed-reliability-records';
import { seedReliabilitySetup } from './seed-reliability-setup';
import { seedRules } from './seed-rules';
import { seedTasks } from './seed-tasks';
import { seedTransitionMatrix } from './seed-transitions';
import { seedValuationFinance } from './seed-valuation-finance';
import { ShowcaseContext } from './showcase-context';
import { verifyShowcase } from './verify-showcase';

interface Step {
  name: string;
  /** reference steps always run */
  always: boolean;
  /** scenario kinds the step applies to */
  kinds: ReadonlyArray<'full' | 'small' | 'partner'>;
  run: (ctx: ShowcaseContext) => Promise<void>;
}

const PLANTS = ['full', 'small'] as const;

const STEPS: readonly Step[] = [
  { name: 'master-data', always: true, kinds: PLANTS, run: seedMasterData },
  { name: 'codes', always: true, kinds: PLANTS, run: seedCodeLibraries },
  { name: 'rules', always: false, kinds: PLANTS, run: seedRules },
  { name: 'calendars', always: false, kinds: PLANTS, run: seedCalendars },
  {
    name: 'reliability-setup',
    always: false,
    kinds: ['full'],
    run: seedReliabilitySetup,
  },
  { name: 'profiles', always: true, kinds: PLANTS, run: seedProfiles },
  {
    name: 'valuation-policy',
    always: false,
    kinds: PLANTS,
    run: seedValuationPolicy,
  },
  // Demo RCA trigger policy before the events and approvals evaluate the triggers
  { name: 'rca-policy', always: false, kinds: PLANTS, run: seedRcaPolicy },
  { name: 'plans', always: false, kinds: PLANTS, run: seedPlans },
  {
    name: 'transitions',
    always: false,
    kinds: ['full'],
    run: seedTransitionMatrix,
  },
  { name: 'cleanup', always: false, kinds: ['full'], run: closeStaleStops },
  { name: 'events', always: false, kinds: PLANTS, run: seedEvents },
  { name: 'open-stops', always: false, kinds: PLANTS, run: seedOpenStops },
  {
    name: 'rca-events',
    always: false,
    kinds: PLANTS,
    run: seedRcaFailureStops,
  },
  // Demo lot dispositions (SME E3) before the recalculation, so the actuals carry their classes
  {
    name: 'dispositions',
    always: false,
    kinds: ['full'],
    run: seedDispositions,
  },
  { name: 'recalculate', always: false, kinds: PLANTS, run: recalculate },
  { name: 'accounting', always: false, kinds: PLANTS, run: seedAccounting },
  {
    name: 'valuation-finance',
    always: false,
    kinds: ['full'],
    run: seedValuationFinance,
  },
  {
    name: 'reliability-records',
    always: false,
    kinds: ['full'],
    run: seedReliabilityRecords,
  },
  { name: 'rca', always: false, kinds: PLANTS, run: seedRcaCases },
  { name: 'tasks', always: false, kinds: PLANTS, run: seedTasks },
  { name: 'integration', always: false, kinds: ['full'], run: seedIntegration },
  {
    name: 'partner-events',
    always: false,
    kinds: ['partner'],
    run: seedPartnerEvents,
  },
  {
    name: 'verify',
    always: false,
    kinds: ['full', 'small', 'partner'],
    run: verifyShowcase,
  },
];

export async function runSteps(
  ctx: ShowcaseContext,
  only: Set<string> | null,
  skip: Set<string> | null,
): Promise<void> {
  for (const step of STEPS) {
    if (!step.kinds.includes(ctx.scenario.kind)) continue;
    const selected =
      step.always || ((!only || only.has(step.name)) && !skip?.has(step.name));
    if (!selected) continue;
    const started = Date.now();
    ctx.logger.log(`step ${step.name} …`);
    await step.run(ctx);
    ctx.logger.log(
      `step ${step.name} done in ${Math.round((Date.now() - started) / 1000)} s`,
    );
  }
}
