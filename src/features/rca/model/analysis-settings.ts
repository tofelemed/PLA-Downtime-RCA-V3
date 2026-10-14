/**
 * Default fishbone categories of the analysis tools (v1 set). 5-Why depth and FMEA thresholds come from the
 * server's RCA policy (SME CA5 / CA6), never from constants here.
 */
export const ANALYSIS_SETTINGS = {
  fishbone: {
    categories: ['Man (People)', 'Machine (Equipment)', 'Material', 'Method (Process)', 'Measurement', 'Environment'],
  },
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
