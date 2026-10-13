import { RcaBarrierAnalysis } from '../rca-analysis-methodology/entities/barrier-analysis.entity';
import { RcaChangeAnalysis } from '../rca-analysis-methodology/entities/change-analysis.entity';
import { RcaFaultTreeAnalysis } from '../rca-analysis-methodology/entities/fault-tree-analysis.entity';
import { RcaFishboneDiagram } from '../rca-analysis-methodology/entities/fishbone-diagram.entity';
import { RcaFiveWhyAnalysis } from '../rca-analysis-methodology/entities/five-why-analysis.entity';
import { RcaFmeaAnalysis } from '../rca-analysis-methodology/entities/fmea-analysis.entity';
import { bool, parseArray, Raw, strings, text } from './rca-json-read';
import { FaultTreeReason, topEventProbability } from '../domain/rca/fault-tree';

/** Common part of a stored analysis record (ETag = rowVersion). */
export interface RcaAnalysisMeta {
  id: string;
  rowVersion: number;
  updatedAt: string;
}

export interface FiveWhyView extends RcaAnalysisMeta {
  problem: string;
  whyLevels: Array<{
    level: number;
    question: string;
    answer: string;
    justification: string | null;
  }>;
  rootCause: string;
}

export interface FishboneView extends RcaAnalysisMeta {
  effect: string;
  categories: Array<{
    id: string;
    name: string;
    causes: Array<{
      id: string;
      description: string;
      isPrimary: boolean;
      likelihood: string;
    }>;
  }>;
}

export interface FmeaView extends RcaAnalysisMeta {
  failureMode: string;
  effects: Array<{
    id: string;
    description: string;
    severity: number;
    currentControls: string;
    detection: number;
  }>;
  /** `rpn` is computed by the server when the record is saved */
  causes: Array<{
    id: string;
    description: string;
    occurrence: number;
    rpn: number;
    recommendedActions: string[];
  }>;
}

export interface FaultTreeView extends RcaAnalysisMeta {
  topEvent: string;
  nodes: Array<{
    id: string;
    type: string;
    description: string;
    parentId: string | null;
    probability: number | null;
  }>;
  /** RCA-06: computed on the server (independent basic events); null with the reason otherwise */
  topEventProbability: number | null;
  topEventProbabilityReason: FaultTreeReason | null;
}

export interface BarrierView extends RcaAnalysisMeta {
  hazard: string;
  barriers: Array<{
    id: string;
    type: string;
    description: string;
    effectiveness: string;
    failureReason: string | null;
    recommendations: string[];
  }>;
}

export interface ChangeView extends RcaAnalysisMeta {
  question: string;
  changes: Array<{
    id: string;
    category: string;
    description: string;
    changeDate: string;
    relatedToIncident: boolean;
    impactLevel: string;
  }>;
}

/** Every tool record of a case; a tool nobody saved yet is null. */
export interface RcaAnalysesV2View {
  fiveWhy: FiveWhyView | null;
  fishbone: FishboneView | null;
  fmea: FmeaView | null;
  faultTree: FaultTreeView | null;
  barrier: BarrierView | null;
  change: ChangeView | null;
}

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const str = (value: unknown): string => text(value) ?? '';

function meta(row: {
  id: string;
  rowVersion: number;
  updatedAt: Date;
}): RcaAnalysisMeta {
  return {
    id: row.id,
    rowVersion: row.rowVersion,
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

const itemId = (raw: Raw, prefix: string, index: number) =>
  text(raw.id) ?? `${prefix}-${index + 1}`;

export function fiveWhyView(row: RcaFiveWhyAnalysis): FiveWhyView {
  return {
    ...meta(row),
    problem: row.problem,
    whyLevels: parseArray(row.whyLevels).map((raw, index) => ({
      level: num(raw.level, index + 1),
      question: str(raw.question),
      answer: str(raw.answer),
      justification: text(raw.justification),
    })),
    rootCause: row.rootCause,
  };
}

export function fishboneView(row: RcaFishboneDiagram): FishboneView {
  return {
    ...meta(row),
    effect: row.effect,
    categories: parseArray(row.categories).map((raw, index) => ({
      id: itemId(raw, 'cat', index),
      name: str(raw.name),
      causes: parseArray(raw.causes).map((cause, at) => ({
        id: itemId(cause, 'cause', at),
        description: str(cause.description),
        isPrimary: bool(cause.isPrimary) ?? false,
        likelihood: text(cause.likelihood) ?? 'Medium',
      })),
    })),
  };
}

export function fmeaView(row: RcaFmeaAnalysis): FmeaView {
  return {
    ...meta(row),
    failureMode: row.failureMode,
    effects: parseArray(row.effects).map((raw, index) => ({
      id: itemId(raw, 'effect', index),
      description: str(raw.description),
      severity: num(raw.severity, 5),
      currentControls: str(raw.currentControls),
      detection: num(raw.detection, 5),
    })),
    causes: parseArray(row.causes).map((raw, index) => ({
      id: itemId(raw, 'cause', index),
      description: str(raw.description),
      occurrence: num(raw.occurrence, 5),
      rpn: num(raw.rpn, 0),
      recommendedActions: strings(raw.recommendedActions),
    })),
  };
}

export function faultTreeView(row: RcaFaultTreeAnalysis): FaultTreeView {
  const nodes = parseArray(row.nodes).map((raw, index) => ({
    id: itemId(raw, 'node', index),
    type: text(raw.type) ?? 'BasicEvent',
    description: str(raw.description),
    parentId: text(raw.parentId),
    probability: typeof raw.probability === 'number' ? raw.probability : null,
  }));
  const top = topEventProbability(nodes);
  return {
    ...meta(row),
    topEvent: row.topEvent,
    nodes,
    topEventProbability: top.probability,
    topEventProbabilityReason: top.reason,
  };
}

export function barrierView(row: RcaBarrierAnalysis): BarrierView {
  return {
    ...meta(row),
    hazard: row.hazard,
    barriers: parseArray(row.barriers).map((raw, index) => ({
      id: itemId(raw, 'barrier', index),
      type: text(raw.type) ?? 'Prevention',
      description: str(raw.description),
      effectiveness: text(raw.effectiveness) ?? 'Moderate',
      failureReason: text(raw.failureReason),
      recommendations: strings(raw.recommendations),
    })),
  };
}

export function changeView(row: RcaChangeAnalysis): ChangeView {
  return {
    ...meta(row),
    question: row.question,
    changes: parseArray(row.changes).map((raw, index) => ({
      id: itemId(raw, 'change', index),
      category: text(raw.category) ?? 'Process',
      description: str(raw.description),
      changeDate: str(raw.changeDate),
      relatedToIncident: bool(raw.relatedToIncident) ?? false,
      impactLevel: text(raw.impactLevel) ?? 'Medium',
    })),
  };
}
