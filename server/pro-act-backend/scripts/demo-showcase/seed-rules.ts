/**
 * Default code mapping rules (reason → OEE component, schedule class, impact code) for every leaf reason,
 * and two declarative `coding_default` rules limited to the showcase units: authored by a master-data
 * admin, activated by a manager. Existing rules (same kind and source, or same name) are kept.
 */
import { allLeaves } from './catalog-codes';
import { MASTER_DATA_FROM } from './catalog-plants';
import { ShowcaseContext } from './showcase-context';

interface MappingRow {
  ruleKind: string;
  sourceCodeId: string;
}

interface RuleRow {
  id: string;
  name: string;
  state: string;
  rowVersion: number;
}

type MappingKind =
  | 'reason_to_oee'
  | 'reason_to_schedule_class'
  | 'reason_to_impact';

async function seedMappingRules(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 1);
  const rows = await author.listAll<MappingRow>('/v2/code-mapping-rules');
  const known = new Set(rows.map((r) => `${r.ruleKind}:${r.sourceCodeId}`));
  for (const leaf of allLeaves()) {
    const sourceCodeId = ctx.ids.reasons.get(leaf.code);
    if (!sourceCodeId) continue;
    const impactId = ctx.ids.impacts.get(leaf.impact);
    const targets: Array<[MappingKind, Record<string, string>]> = [
      ['reason_to_oee', { targetValue: leaf.oee }],
      ['reason_to_schedule_class', { targetValue: leaf.schedule }],
    ];
    if (impactId)
      targets.push(['reason_to_impact', { targetCodeId: impactId }]);
    for (const [ruleKind, target] of targets) {
      if (known.has(`${ruleKind}:${sourceCodeId}`)) {
        ctx.tally.kept('code mapping rules');
        continue;
      }
      ctx.tally.created('code mapping rules');
      if (ctx.dryRun) continue;
      await author.post(
        '/v2/code-mapping-rules',
        {
          ruleKind,
          sourceCodeId,
          effectiveFrom: `${MASTER_DATA_FROM}T00:00:00.000Z`,
          ...target,
        },
        `mapping ${ruleKind} ${leaf.code}`,
      );
    }
  }
}

interface RuleSpec {
  name: string;
  description: string;
  priority: number;
  definition: (
    unitIds: string[],
    ctx: ShowcaseContext,
  ) => Record<string, unknown>;
}

const RULES: readonly RuleSpec[] = [
  {
    name: 'Short stops are minor stops (performance)',
    description:
      'Stops shorter than 5 minutes on the production lines count as minor stops in the performance loss.',
    priority: 20,
    definition: (unitIds) => ({
      when: {
        all: [
          { field: 'physicalType', op: 'eq', value: 'downtime' },
          { field: 'durationSeconds', op: 'lt', value: 300 },
          { field: 'unitId', op: 'in', value: unitIds },
        ],
      },
      then: [{ set: 'oeeComponent', value: 'performance' }],
    }),
  },
  {
    name: 'Long uncoded stops are unplanned equipment failures',
    description:
      'A stop of 30 minutes or more that nobody classified is unplanned and valued as an equipment failure until coded.',
    priority: 10,
    definition: (unitIds, ctx) => ({
      when: {
        all: [
          { field: 'physicalType', op: 'eq', value: 'downtime' },
          { field: 'durationSeconds', op: 'gte', value: 1800 },
          { field: 'unitId', op: 'in', value: unitIds },
        ],
      },
      then: [
        { set: 'scheduleClass', value: 'unplanned' },
        { set: 'impactCodeId', value: ctx.ids.impacts.get('IC001') ?? '' },
      ],
    }),
  },
];

async function seedDeclarativeRules(ctx: ShowcaseContext): Promise<void> {
  const author = ctx.as('authors', 0);
  const unitIds = [...ctx.ids.units.values()];
  const rules = await author.listAll<RuleRow>('/v2/rules', {
    kind: 'coding_default',
  });
  for (const spec of RULES) {
    let rule = rules.find((r) => r.name === spec.name);
    if (rule?.state === 'active') {
      ctx.tally.kept('declarative rules');
      continue;
    }
    if (ctx.dryRun) {
      ctx.tally.created('declarative rules');
      continue;
    }
    if (!rule) {
      rule = await author.post<RuleRow>(
        '/v2/rules',
        {
          kind: 'coding_default',
          name: spec.name,
          description: spec.description,
          priority: spec.priority,
          definition: spec.definition(unitIds, ctx),
        },
        `rule ${spec.name}`,
      );
    }
    const approver = ctx.approverOtherThan(ctx.persona('authors', 0));
    await approver.post(
      `/v2/rules/${rule.id}/activate`,
      { reason: 'Showcase coding defaults reviewed' },
      `activate ${rule.id}`,
      {
        ifMatch: rule.rowVersion,
      },
    );
    ctx.tally.created('declarative rules');
  }
}

export async function seedRules(ctx: ShowcaseContext): Promise<void> {
  await seedMappingRules(ctx);
  if (ctx.ids.units.size > 0) await seedDeclarativeRules(ctx);
}
