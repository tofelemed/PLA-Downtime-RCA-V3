import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { useUnsavedChangesGuard } from '@/features/ux-kit/use-unsaved-changes-guard';
import { useRcaFormat } from '../../use-rca-format';
import { EMPTY_EVIDENCE_FORM, evidenceFormOf, evidenceItemOf, type EvidenceForm } from '../../model/evidence-form';
import { newItemId } from '../../model/rca-form';
import { useCaseWorkspace } from '../case-context';
import { useCasePatch } from '../use-case-patch';
import { AttachmentsField } from './attachments-field';
import { CaseCard } from '../components/case-card';
import { EvidenceClassificationFields, EvidenceDetailsFields, EvidenceTaskFields } from './evidence-fields';
import { FormFooter } from '../components/form-controls';
import { SeriesFields } from './series-fields';

function useEvidenceSave(existing: RcaEvidenceItem | undefined) {
  const { rca, basePath } = useCaseWorkspace();
  const { session } = useAuth();
  const navigate = useNavigate();
  const patch = useCasePatch();
  const save = async (form: EvidenceForm) => {
    const base = existing ?? {
      id: newItemId('ev', rca.evidence),
      collectedAt: new Date().toISOString(),
      collectedBy: session?.user.id ?? null,
      nodeIds: [],
      verifiedBy: null,
      verifiedAt: null,
    };
    const item = evidenceItemOf(form, base);
    const evidence = existing ? rca.evidence.map((entry) => (entry.id === existing.id ? item : entry)) : [...rca.evidence, item];
    const result = await patch.save({ evidence }).catch(() => null);
    if (result) navigate(`${basePath}/evidence/${encodeURIComponent(item.id)}`, { replace: true });
  };
  return { save, error: patch.error, isPending: patch.isPending };
}

/** Where Cancel goes: the item being edited, else the list. */
const backPath = (basePath: string, existing: RcaEvidenceItem | undefined) =>
  existing ? `${basePath}/evidence/${encodeURIComponent(existing.id)}` : `${basePath}/evidence`;

/** `/rca/:caseId/evidence/new` and `…/:evidenceId/edit`: the evidence form with files and historian query. */
export function EvidenceFormPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  const { evidenceId } = useParams();
  const navigate = useNavigate();
  const existing = evidenceId ? rca.evidence.find((entry) => entry.id === evidenceId) : undefined;
  const [initial] = useState<EvidenceForm>(() => (existing ? evidenceFormOf(existing, timezone) : EMPTY_EVIDENCE_FORM));
  const [form, setForm] = useState<EvidenceForm>(initial);
  const [busy, setBusy] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const saving = useEvidenceSave(existing);
  useUnsavedChangesGuard(JSON.stringify(form) !== JSON.stringify(initial));
  if (readOnly || (evidenceId && !existing)) return <Navigate to={`${basePath}/evidence`} replace />;
  const change = (patch: Partial<EvidenceForm>) => setForm((current) => ({ ...current, ...patch }));
  const cancel = () => navigate(backPath(basePath, existing));
  return (
    <CaseCard title={existing ? `Edit evidence: ${existing.title}` : 'Add evidence'}>
      <form
        className="space-y-6"
        data-testid="evidence-form"
        onSubmit={(e) => {
          e.preventDefault();
          void saving.save(form);
        }}
      >
        <EvidenceDetailsFields form={form} onChange={change} titleTouched={titleTouched} onTitleBlur={() => setTitleTouched(true)} />
        {form.type === 'Time Series' && <SeriesFields value={form.series} onChange={(series) => change({ series })} />}
        <EvidenceClassificationFields form={form} onChange={change} />
        <EvidenceTaskFields form={form} onChange={change} />
        <AttachmentsField rcaId={rca.id} value={form.attachments} onChange={(attachments) => change({ attachments })} onBusy={setBusy} />
        {saving.error ? <FriendlyErrorAlert error={saving.error} /> : null}
        <FormFooter>
          <Button type="button" size="sm" variant="outline" onClick={cancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={form.title.trim() === '' || busy || saving.isPending} data-testid="save-evidence">
            {existing ? 'Save evidence' : 'Add evidence'}
          </Button>
        </FormFooter>
      </form>
    </CaseCard>
  );
}
