import { EntityManager, FindOptionsWhere } from 'typeorm';
import { CloseAction } from '../domain/rca/close-gate';
import { InvestigationFacts } from '../domain/rca/investigation-gate';
import {
  AnalysisMethod,
  ConsequenceClass,
  CONSEQUENCE_CLASSES,
} from '../domain/rca/rca-policy-rules';
import { RcaPolicy } from '../domain/rca/rca-policy';
import { RcaBarrierAnalysis } from '../rca-analysis-methodology/entities/barrier-analysis.entity';
import { RcaChangeAnalysis } from '../rca-analysis-methodology/entities/change-analysis.entity';
import { RcaFaultTreeAnalysis } from '../rca-analysis-methodology/entities/fault-tree-analysis.entity';
import { RcaFishboneDiagram } from '../rca-analysis-methodology/entities/fishbone-diagram.entity';
import { RcaFiveWhyAnalysis } from '../rca-analysis-methodology/entities/five-why-analysis.entity';
import { RcaFmeaAnalysis } from '../rca-analysis-methodology/entities/fmea-analysis.entity';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RCA } from '../rca/rca.entity';
import { hasCompletionEvidence } from './action-completion';
import {
  barrierView,
  changeView,
  faultTreeView,
  fishboneView,
  fiveWhyView,
  fmeaView,
} from './rca-analysis.view';
import { readEventDiagram } from './rca-case-diagram';
import { readIds, readLogicTree } from './rca-case-json';

interface ToolRow {
  rcaId: string;
  updatedAt: Date;
}

function latest<E extends ToolRow>(
  manager: EntityManager,
  type: new () => E,
  rcaId: string,
): Promise<E | null> {
  return manager.getRepository(type).findOne({
    where: { rcaId } as FindOptionsWhere<E>,
    order: { updatedAt: 'DESC' } as never,
  });
}

const answered = (text: string | null | undefined) => Boolean(text?.trim());

async function toolFacts(manager: EntityManager, rca: RCA, policy: RcaPolicy) {
  const [fiveWhy, fishbone, fmea, faultTree, barrier, change] =
    await Promise.all([
      latest(manager, RcaFiveWhyAnalysis, rca.id),
      latest(manager, RcaFishboneDiagram, rca.id),
      latest(manager, RcaFmeaAnalysis, rca.id),
      latest(manager, RcaFaultTreeAnalysis, rca.id),
      latest(manager, RcaBarrierAnalysis, rca.id),
      latest(manager, RcaChangeAnalysis, rca.id),
    ]);
  const five = fiveWhy ? fiveWhyView(fiveWhy) : null;
  const scored = fmea ? fmeaView(fmea, policy.fmea) : null;
  const used: Record<AnalysisMethod, boolean> = {
    five_why: Boolean(five?.whyLevels.some((level) => answered(level.answer))),
    fishbone: Boolean(
      fishbone &&
        fishboneView(fishbone).categories.some((c) => c.causes.length > 0),
    ),
    fmea: Boolean(scored && scored.causes.length > 0),
    fault_tree: Boolean(faultTree && faultTreeView(faultTree).nodes.length > 0),
    barrier: Boolean(barrier && barrierView(barrier).barriers.length > 0),
    change: Boolean(change && changeView(change).changes.length > 0),
    logic_tree: readLogicTree(rca.logicTree).length >= 2,
    timeline: readEventDiagram(rca.eventDiagram).nodes.length >= 1,
  };
  return { five, scored, used };
}

const consequenceOf = (
  value: string | null | undefined,
): ConsequenceClass | null =>
  (CONSEQUENCE_CLASSES as readonly string[]).includes(value ?? '')
    ? (value as ConsequenceClass)
    : null;

/** CA1 investigation facts of a case: methods with content, 5-Why, FMEA completeness, team, charter, actions. */
export async function investigationFacts(
  manager: EntityManager,
  input: {
    rca: RCA;
    policy: RcaPolicy;
    actionCount: number;
    /** root causes with a cause code (item 7 count) */
    codedRootCauses: number;
  },
): Promise<InvestigationFacts> {
  const { rca } = input;
  const { five, scored, used } = await toolFacts(manager, rca, input.policy);
  const team = new Set(
    [rca.teamLeadId, ...readIds(rca.teamMemberIds)].filter(Boolean),
  );
  return {
    consequenceClass: consequenceOf(rca.consequenceClass),
    rootCause: rca.rootCause ?? null,
    teamSize: team.size,
    teamCharter: rca.teamCharter ?? null,
    codedRootCauses: input.codedRootCauses,
    methods: (Object.keys(used) as AnalysisMethod[]).filter(
      (method) => used[method],
    ),
    fiveWhy:
      used.five_why && five
        ? { levels: five.whyLevels, rootCause: five.rootCause }
        : null,
    fmea: used.fmea && scored ? { complete: scored.complete } : null,
    actionCount: input.actionCount,
  };
}

/** CA4 / CA2 facts of a case's actions for the closure gate. */
export function closeActions(actions: readonly RcaAction[]): CloseAction[] {
  return actions.map((action) => ({
    status: action.status,
    hasEvidence: hasCompletionEvidence(action),
    verificationPlanned: Boolean(
      action.baseline && action.verificationWindowEnd,
    ),
    verdict: action.postAction?.effectiveness?.verdict ?? null,
  }));
}

export async function caseActions(
  manager: EntityManager,
  rca: RCA,
): Promise<RcaAction[]> {
  return manager.getRepository(RcaAction).find({
    where: { rcaId: rca.id, tenantId: rca.tenantId ?? '' },
    order: { createdAt: 'ASC' },
  });
}
