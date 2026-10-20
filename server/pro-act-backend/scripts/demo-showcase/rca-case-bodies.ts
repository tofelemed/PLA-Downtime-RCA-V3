/**
 * Request bodies of the DEMO RCA cases (catalog-rca): the case with its team, consequence class, logic tree
 * and event timeline, the 5-Why with evidence per level, and the actions (type, objective evidence, a
 * verification window and a server-computed baseline — no typed baseline value, SME CA3).
 */
import { ActionSpec, CaseSpec } from './catalog-rca';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, HOUR_MS, iso } from './showcase-window';

const START_HOUR = 10;

function teamOf(ctx: ShowcaseContext, spec: CaseSpec): string[] {
  if (spec.stage === 'draft') return [];
  return [
    ...ctx.scenario.cast.engineers.slice(0, 2),
    ctx.persona('operators', 0),
  ]
    .map((persona) => ctx.ids.users.get(persona))
    .filter((id): id is string => Boolean(id));
}

function logicTree(spec: CaseSpec) {
  if (!spec.rootCause) return [];
  return [
    {
      id: 'n1',
      parentId: null,
      label: spec.title.replace(/^Demo: /, ''),
      kind: 'event',
      status: 'open',
      notes: null,
    },
    {
      id: 'n2',
      parentId: 'n1',
      label: spec.rootCause.slice(0, 500),
      kind: 'hypothesis',
      status: 'verified',
      notes: 'Demo',
    },
  ];
}

/** The failure stops as the case's event timeline (SME CA7 tier 2 asks for a timeline). */
function eventDiagram(ctx: ShowcaseContext, spec: CaseSpec) {
  const stops = spec.failureStops;
  if (!stops) return null;
  const nodes = [...stops.daysAgo]
    .sort((a, b) => b - a)
    .map((days, index) => ({
      id: `stop-${days}`,
      label: `Demo: ${stops.modeLabel}`,
      type: 'Failure',
      timestamp: iso(ctx.window.today - days * DAY_MS + START_HOUR * HOUR_MS),
      description: `${stops.minutes} min stop`,
      position: { x: 160 * index, y: 0 },
    }));
  const edges = nodes.slice(1).map((node, index) => ({
    id: `edge-${index}`,
    source: nodes[index].id,
    target: node.id,
  }));
  return { nodes, edges };
}

export function caseBody(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  lead: string,
): Record<string, unknown> {
  const diagram = eventDiagram(ctx, spec);
  return {
    title: spec.title,
    description: spec.description,
    status: spec.stage === 'draft' ? 'Draft' : 'In Progress',
    priority: spec.priority,
    consequenceClass: spec.consequenceClass,
    unitId: ctx.ids.units.get(spec.unitKey),
    assetId: spec.failureStops
      ? (ctx.ids.assets.get(`${spec.unitKey}:${spec.failureStops.assetKind}`) ??
        null)
      : null,
    teamLeadId: ctx.ids.users.get(lead) ?? null,
    teamMemberIds: teamOf(ctx, spec),
    targetCloseDate: iso(ctx.window.today + 21 * DAY_MS),
    ...(spec.teamCharter ? { teamCharter: spec.teamCharter } : {}),
    rootCause: spec.rootCause,
    recommendations: spec.recommendations.map((title) => ({ title })),
    logicTree: logicTree(spec),
    ...(diagram ? { eventDiagram: diagram } : {}),
  };
}

export function fiveWhyBody(spec: CaseSpec): Record<string, unknown> | null {
  if (!spec.fiveWhy || !spec.rootCause) return null;
  return {
    problem: spec.title.replace(/^Demo: /, ''),
    whyLevels: spec.fiveWhy.map((level, index) => ({
      level: index + 1,
      question: index === 0 ? 'Why did it stop?' : 'Why?',
      answer: level.answer,
      justification: level.evidence,
    })),
    rootCause: spec.rootCause,
  };
}

export function actionBody(
  ctx: ShowcaseContext,
  action: ActionSpec,
  index: number,
): Record<string, unknown> {
  const day = (daysAgo: number) => iso(ctx.window.today - daysAgo * DAY_MS);
  const body: Record<string, unknown> = {
    title: action.title,
    description: action.description,
    actionType: action.actionType,
    ownerId: ctx.ids.users.get(ctx.persona(action.ownerRole, index)) ?? null,
    dueDate: iso(ctx.window.today + action.dueInDays * DAY_MS),
    status: action.status,
  };
  if (action.evidence) body.completionEvidenceRef = action.evidence;
  if (action.completedDaysAgo !== undefined)
    body.completedAt = day(action.completedDaysAgo);
  if (action.verification) {
    body.verificationWindowStart = day(action.verification.fromDaysAgo);
    body.verificationWindowEnd = day(action.verification.toDaysAgo);
    body.baseline = { metric: 'recurrences' };
  }
  if (action.claimedAvoidedLossUsd) {
    body.claimedAvoidedLoss = action.claimedAvoidedLossUsd;
    body.claimedCurrency = 'USD';
  }
  return body;
}
