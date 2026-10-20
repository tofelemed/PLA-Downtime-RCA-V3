/** Plain words of the stored RCA keys printed in the case PDF (item 2.5); unknown keys read with spaces. */
const words =
  (table: Readonly<Record<string, string>>) =>
  (key: string | null | undefined): string => {
    if (!key) return '—';
    return table[key] ?? key.replace(/_/g, ' ');
  };

export const verdictWords = words({
  effective: 'Effective',
  not_effective: 'Not effective',
  insufficient_evidence: 'Insufficient evidence',
});

export const actionStatusWords = words({
  open: 'Open',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
});

export const verificationWords = words({
  not_planned: 'Not planned',
  pending: 'Window open',
  due: 'Due for evaluation',
  evaluated: 'Evaluated',
});

export const metricWords = words({
  recurrences: 'Recurrences',
  downtime_seconds: 'Downtime (seconds)',
});

export const causeKindWords = words({
  root: 'Root',
  direct: 'Direct',
  contributing: 'Contributing',
});

export const consequenceWords = words({
  minor: 'Minor',
  significant: 'Significant',
  major: 'Major',
  critical: 'Critical',
});

/** Order of the cause kinds in the PDF: root first. */
export const CAUSE_KIND_ORDER: readonly string[] = [
  'root',
  'direct',
  'contributing',
];

/** One History entry of the timeline in words: the opening, or the status move. */
export function timelineChange(entry: {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
}): string {
  if (entry.action === 'rca_case.created')
    return `Opened${entry.toStatus ? ` (${entry.toStatus})` : ''}`;
  return `${entry.fromStatus ?? '—'} → ${entry.toStatus ?? '—'}`;
}
