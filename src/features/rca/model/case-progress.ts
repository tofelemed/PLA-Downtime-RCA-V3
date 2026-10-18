import type { RcaActionView, RcaCaseView } from '@/api/v2/types/rca';

/** One step of the investigation checklist (shown with its state; the workflow gates are the server's). */
export interface ProgressStep {
  key: string;
  label: string;
  done: boolean;
  hint: string;
}

/**
 * The investigation steps of v1's phase stepper (definition → data collection → analysis →
 * actions → closure), read from the case content. A guide for the team, not a rule. The actions step
 * counts corrective actions, the basis of closure (DECISIONS 2026-10-18, F-3); `actions` is undefined
 * while they load and 'error' when they could not be loaded.
 */
export function progressSteps(rca: RcaCaseView, hasToolRecord: boolean, actions?: readonly Pick<RcaActionView, 'status'>[] | 'error'): ProgressStep[] {
  const evidence = rca.evidence.length;
  return [
    {
      key: 'definition',
      label: 'Definition',
      done: Boolean(rca.description && rca.teamCharter && rca.teamMemberIds.length > 0),
      hint: 'Problem statement, team charter and at least one team member.',
    },
    { key: 'evidence', label: 'Data collection', done: evidence > 0, hint: `${evidence} evidence item(s).` },
    {
      key: 'analysis',
      label: 'Analysis',
      done: rca.logicTree.length > 0 || hasToolRecord || Boolean(rca.rootCause),
      hint: rca.rootCause ? 'Root cause written down.' : 'Logic tree or an analysis tool, then the root cause.',
    },
    actionsStep(actions),
    {
      key: 'closure',
      label: 'Closure',
      done: rca.status === 'Closed',
      hint: 'Request closure once the actions are done with evidence and verified; an independent manager approves it.',
    },
  ];
}

/** Corrective actions: done when there is one and every action not cancelled is done. */
function actionsStep(actions: readonly Pick<RcaActionView, 'status'>[] | 'error' | undefined): ProgressStep {
  if (actions === 'error') return { key: 'actions', label: 'Actions', done: false, hint: 'The actions could not be loaded.' };
  if (!actions) return { key: 'actions', label: 'Actions', done: false, hint: 'Loading the actions…' };
  const live = actions.filter((action) => action.status !== 'cancelled');
  const done = live.filter((action) => action.status === 'done').length;
  return {
    key: 'actions',
    label: 'Actions',
    done: live.length > 0 && done === live.length,
    hint: `${live.length} action(s), ${done} done.`,
  };
}
