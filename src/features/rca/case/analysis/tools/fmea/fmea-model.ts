import type { FmeaContent, FmeaRecord, FmeaScoredCause } from '@/api/v2/types/rca-analyses';

/** The editable content of a saved record: without what the server computed and without effect detection. */
export function contentOf(record: FmeaRecord | null, fallbackMode: string): FmeaContent {
  return {
    failureMode: record?.failureMode ?? fallbackMode,
    effects: (record?.effects ?? []).map(({ id, description, severity, currentControls }) => ({ id, description, severity, currentControls })),
    causes: (record?.causes ?? []).map(({ id, description, occurrence, detection, detectionControl, recommendedActions }) => ({
      id,
      description,
      occurrence,
      detection,
      detectionControl,
      recommendedActions,
    })),
  };
}

const RATING_WORDS: Readonly<Record<string, string>> = { severity: 'severity', occurrence: 'occurrence', detection: 'detection' };

export interface CauseScore {
  text: string;
  /** the server says it needs action (RPN at or over the threshold, high priority or severe) */
  alert: boolean;
}

/** What the server computed for a saved cause, in words; null before the first save of the cause. */
export function causeScore(scored: FmeaScoredCause | undefined, method: FmeaRecord['method'] | undefined): CauseScore | null {
  if (!scored) return null;
  if (scored.missing.length > 0) {
    return { text: `incomplete: ${scored.missing.map((rating) => RATING_WORDS[rating] ?? rating).join(', ')} missing`, alert: false };
  }
  const main = method === 'action_priority' && scored.actionPriority ? `priority ${scored.actionPriority}` : `RPN ${scored.rpn ?? '—'}`;
  const extra = method !== 'action_priority' && scored.actionPriority ? ` · priority ${scored.actionPriority}` : '';
  return { text: `${main}${extra}${scored.needsAction ? ' · needs action' : ''}`, alert: scored.needsAction === true };
}

/** The RPN column of a cause: the server's number, or "—" before a save or while a rating is missing. */
export const rpnText = (scored: FmeaScoredCause | undefined): string => (scored?.rpn === null || scored?.rpn === undefined ? '—' : String(scored.rpn));

/** The assessment column (beside the RPN column): priority and "needs action", the missing ratings, or "Scored after save". */
export function causeStatus(scored: FmeaScoredCause | undefined): CauseScore {
  if (!scored) return { text: 'Scored after save', alert: false };
  if (scored.missing.length > 0) return { text: `Incomplete: ${scored.missing.map((rating) => RATING_WORDS[rating] ?? rating).join(', ')} missing`, alert: false };
  const parts = [scored.actionPriority ? `Priority ${scored.actionPriority}` : '', scored.needsAction ? 'needs action' : ''].filter(Boolean);
  return { text: parts.length ? parts.join(' · ') : scored.needsAction === false ? 'No action needed' : '—', alert: scored.needsAction === true };
}

/** The scoring rules of the saved record, as the server returned them. */
export function rulesText(record: FmeaRecord | null): string {
  if (!record) return 'Scored by the server with the RCA policy rules when saved.';
  const method = record.method === 'action_priority' ? 'action priority' : `RPN (worst severity × occurrence × detection)`;
  return `Scored by ${method}; needs action from RPN ${record.rpnThreshold} or severity ${record.severityReview}.${record.complete ? '' : ' Not every rating is filled in yet.'}`;
}
