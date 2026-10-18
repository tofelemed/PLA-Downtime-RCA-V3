import { useState } from 'react';
import { isBulkPreview, isJobAccepted, useBulkCode, type BulkCodeBody, type EventRef } from '@/api/v2/queries/event-commands';
import type { BulkCodeAppliedView, BulkCodePreviewView } from '@/api/v2/types/event-operations';

/** SME D12 in bulk: leave the flag as it is (not sent), set it (true) or clear it (false). */
export type InvestigationChoice = 'unchanged' | 'set' | 'clear';

export interface BulkCodes {
  reasonCodeId: string;
  scheduleClass: string;
  oeeComponent: string;
  /** A-1: equipment of the events' (one) unit; '' = unchanged */
  assetId: string;
  /** SME D12: 'unchanged' = not sent; 'set' sends true; 'clear' sends false (the server clears the flag) */
  investigationPending: InvestigationChoice;
}

const NO_CODES: BulkCodes = { reasonCodeId: '', scheduleClass: '', oeeComponent: '', assetId: '', investigationPending: 'unchanged' };

export type BulkStep =
  | { kind: 'edit' }
  | { kind: 'preview'; preview: BulkCodePreviewView }
  | { kind: 'applied'; applied: BulkCodeAppliedView }
  | { kind: 'job'; jobId: string };

/** The codes part of the DTO: only chosen codes are sent (at least one is required by the API). */
export function toBulkBody(events: readonly EventRef[], codes: BulkCodes, reason: string, preview: boolean): BulkCodeBody {
  const chosen: BulkCodeBody['codes'] = {};
  if (codes.reasonCodeId) chosen.reasonCodeId = codes.reasonCodeId;
  if (codes.scheduleClass) chosen.scheduleClass = codes.scheduleClass as BulkCodeBody['codes']['scheduleClass'];
  if (codes.oeeComponent) chosen.oeeComponent = codes.oeeComponent as BulkCodeBody['codes']['oeeComponent'];
  if (codes.assetId) chosen.assetId = codes.assetId;
  if (codes.investigationPending !== 'unchanged') chosen.investigationPending = codes.investigationPending === 'set';
  return {
    items: events.map((event) => ({ eventId: event.id, expectedVersion: event.rowVersion })),
    codes: chosen,
    reason: reason.trim(),
    preview,
  };
}

/** At least one code chosen — "Clear investigation pending" alone counts as a change. */
export function hasBulkCode(codes: BulkCodes): boolean {
  return Boolean(codes.reasonCodeId || codes.scheduleClass || codes.oeeComponent || codes.assetId) || codes.investigationPending !== 'unchanged';
}

function previewBlockedReason(hasCode: boolean, reason: string): string | null {
  if (!hasCode) return 'Choose a reason code, schedule class, OEE component, asset or an “investigation pending” change to continue.';
  return reason.trim() === '' ? 'Enter why (kept in the history) to continue.' : null;
}

/**
 * DT10 bulk coding flow: preview (before / after, exclusions, affected windows — nothing changes) →
 * apply. ≤ 500 events are applied atomically; above, the server answers 202 and the job is followed.
 * Editing the codes after a preview returns to the edit step, so an apply always matches a preview.
 */
export function useBulkCodeFlow(events: readonly EventRef[]) {
  const command = useBulkCode();
  const [codes, setCodes] = useState<BulkCodes>(NO_CODES);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<BulkStep>({ kind: 'edit' });

  const run = async (preview: boolean) => {
    const result = await command.submit(toBulkBody(events, codes, reason, preview)).catch(() => null);
    if (!result) return;
    if (isJobAccepted(result)) setStep({ kind: 'job', jobId: result.jobId });
    else if (isBulkPreview(result)) setStep({ kind: 'preview', preview: result });
    else setStep({ kind: 'applied', applied: result });
  };

  const edit = <K extends keyof BulkCodes>(key: K, value: BulkCodes[K]) => {
    setCodes((current) => ({ ...current, [key]: value }));
    setStep({ kind: 'edit' });
  };

  const hasCode = hasBulkCode(codes);
  return {
    codes,
    edit,
    reason,
    setReason: (value: string) => {
      setReason(value);
      setStep({ kind: 'edit' });
    },
    step,
    canPreview: hasCode && reason.trim() !== '' && events.length > 0 && !command.isPending,
    /** why Preview is disabled, in words (null when only a running request blocks it) */
    previewBlocked: previewBlockedReason(hasCode, reason),
    preview: () => run(true),
    apply: () => run(false),
    error: command.error,
    pending: command.isPending,
  };
}
