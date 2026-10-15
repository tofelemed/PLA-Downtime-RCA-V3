import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { EvidenceType } from '@/api/v2/types/reconciliation';
import { Field } from '@/features/integration-console/components/field';
import { NativeSelect } from '@/features/integration-console/components/native-select';
import { ConfirmDialog } from '@/features/ux-kit/confirm-dialog';
import { EVIDENCE_LABELS } from '../model/line-evidence';

export interface CorrectionDraft {
  reason: string;
  evidenceType: EvidenceType;
  evidenceRef: string;
}

export interface ProposeCorrectionDialogProps {
  /** resolves when the proposal was created (closes the dialog); rejects to keep it open */
  onPropose: (draft: CorrectionDraft) => Promise<unknown>;
}

const EVIDENCE_OPTIONS = (Object.keys(EVIDENCE_LABELS) as EvidenceType[]).map((value) => ({ value, label: EVIDENCE_LABELS[value] }));

/**
 * SME R4: a manual change proposal of an approved period whose month is closing or locked — what is wrong,
 * the record it rests on and its reference. Someone else with approval rights accepts or dismisses it.
 */
export function ProposeCorrectionDialog({ onPropose }: ProposeCorrectionDialogProps) {
  const [reason, setReason] = useState('');
  const [evidenceType, setEvidenceType] = useState<EvidenceType | ''>('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const ready = Boolean(reason.trim() && evidenceType && evidenceRef.trim());
  const submit = () => {
    if (!evidenceType) return Promise.reject(new Error('evidence type required'));
    return onPropose({ reason: reason.trim(), evidenceType, evidenceRef: evidenceRef.trim() }).then(() => {
      setReason('');
      setEvidenceType('');
      setEvidenceRef('');
    });
  };
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm" data-testid="propose-correction">
          Propose a correction…
        </Button>
      }
      title="Propose a correction of the approved period"
      description="For a period of a closing or locked month. Another approver accepts or dismisses it; an accepted correction opens a new revision and its restatement."
      confirmLabel="Propose correction"
      confirmDisabled={!ready}
      onConfirm={submit}
    >
      <div className="space-y-3">
        <Field id="correction-reason" label="What is wrong (required)">
          <Textarea id="correction-reason" rows={3} data-testid="correction-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <Field id="correction-evidence-type" label="Evidence (required)">
          <NativeSelect id="correction-evidence-type" testId="correction-evidence-type" value={evidenceType} onChange={(v) => setEvidenceType(v as EvidenceType | '')} options={EVIDENCE_OPTIONS} placeholder="Choose the record" />
        </Field>
        <Field id="correction-evidence-ref" label="Reference (required)" hint="Work order, sample, log entry or tag reading">
          <Input id="correction-evidence-ref" data-testid="correction-evidence-ref" maxLength={200} value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
