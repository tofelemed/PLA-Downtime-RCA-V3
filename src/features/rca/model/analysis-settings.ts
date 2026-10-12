/**
 * Guidance settings of the analysis tools (the "Oil & Gas industry standard" set every plant used in v1;
 * no screen ever changed them). They drive completeness hints only; the server validates the records.
 */
export const ANALYSIS_SETTINGS = {
  fiveWhy: { minimumDepth: 5, requireJustification: true },
  fishbone: {
    categories: ['Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Environment'],
  },
  fmea: { riskThreshold: 100 },
} as const;

export const LIKELIHOODS = ['High', 'Medium', 'Low'] as const;
export const FAULT_TREE_TYPES = ['AND', 'OR', 'Event', 'BasicEvent', 'UndevelopedEvent'] as const;
export const BARRIER_TYPES = ['Prevention', 'Detection', 'Mitigation', 'Recovery'] as const;
export const BARRIER_EFFECTIVENESS = ['Strong', 'Moderate', 'Weak', 'Failed'] as const;
export const CHANGE_CATEGORIES = ['People', 'Equipment', 'Process', 'Materials', 'Environment', 'Management'] as const;
export const DIAGRAM_EVENT_TYPES = ['Failure', 'Alarm', 'Action', 'Note', 'Maintenance', 'Inspection', 'Operator Action', 'Info'] as const;
export const LOGIC_NODE_KINDS = ['Equipment', 'Process', 'Material', 'Personnel', 'Environment', 'Method', 'Cause'] as const;

/** A short unique id for a new row of a tool (labels only; the server keeps them as given). */
export { newItemId as rowId } from './rca-form';
