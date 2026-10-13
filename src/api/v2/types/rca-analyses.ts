/**
 * v2 RCA analysis tool records (`GET /v2/rcas/{id}/analyses`, `PUT /v2/rcas/{id}/analyses/{tool}`; backend
 * `src/rca-case/rca-analysis.view.ts`). A tool nobody saved yet is null.
 */
export interface RcaAnalysisMeta {
  id: string;
  rowVersion: number;
  updatedAt: string;
}

export interface FiveWhyLevel {
  level: number;
  question: string;
  answer: string;
  justification: string | null;
}

export interface FiveWhyContent {
  problem: string;
  whyLevels: FiveWhyLevel[];
  rootCause: string;
}

export interface FishboneCause {
  id: string;
  description: string;
  isPrimary: boolean;
  likelihood: string;
}

export interface FishboneCategory {
  id: string;
  name: string;
  causes: FishboneCause[];
}

export interface FishboneContent {
  effect: string;
  categories: FishboneCategory[];
}

export interface FmeaEffect {
  id: string;
  description: string;
  severity: number;
  currentControls: string;
  detection: number;
}

export interface FmeaCause {
  id: string;
  description: string;
  occurrence: number;
  recommendedActions: string[];
}

export interface FmeaContent {
  failureMode: string;
  effects: FmeaEffect[];
  causes: FmeaCause[];
}

/** Saved FMEA: each cause carries the risk priority number the server computed. */
export interface FmeaRecord extends Omit<FmeaContent, 'causes'> {
  causes: Array<FmeaCause & { rpn: number }>;
}

export interface FaultTreeNode {
  id: string;
  type: string;
  description: string;
  parentId: string | null;
  probability: number | null;
}

export interface FaultTreeContent {
  topEvent: string;
  nodes: FaultTreeNode[];
}

/** Saved fault tree: the top-event probability the server computed (null with the reason, RCA-06). */
export interface FaultTreeRecord extends FaultTreeContent {
  topEventProbability: number | null;
  topEventProbabilityReason: string | null;
}

export interface Barrier {
  id: string;
  type: string;
  description: string;
  effectiveness: string;
  failureReason: string | null;
  recommendations: string[];
}

export interface BarrierContent {
  hazard: string;
  barriers: Barrier[];
}

export interface ChangeRecord {
  id: string;
  category: string;
  description: string;
  changeDate: string;
  relatedToIncident: boolean;
  impactLevel: string;
}

export interface ChangeContent {
  question: string;
  changes: ChangeRecord[];
}

export interface RcaAnalysesView {
  fiveWhy: (FiveWhyContent & RcaAnalysisMeta) | null;
  fishbone: (FishboneContent & RcaAnalysisMeta) | null;
  fmea: (FmeaRecord & RcaAnalysisMeta) | null;
  faultTree: (FaultTreeRecord & RcaAnalysisMeta) | null;
  barrier: (BarrierContent & RcaAnalysisMeta) | null;
  change: (ChangeContent & RcaAnalysisMeta) | null;
}

/** Content each tool PUT sends (FMEA without RPN: the server computes it). */
export interface RcaAnalysisBodies {
  fiveWhy: FiveWhyContent;
  fishbone: FishboneContent;
  fmea: FmeaContent;
  faultTree: FaultTreeContent;
  barrier: BarrierContent;
  change: ChangeContent;
}

export type RcaRecordTool = keyof RcaAnalysisBodies;
