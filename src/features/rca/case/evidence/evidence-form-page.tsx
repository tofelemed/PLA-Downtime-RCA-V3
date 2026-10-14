import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { RcaEvidenceItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { useRcaFormat } from '../../use-rca-format';
import { EMPTY_EVIDENCE_FORM, evidenceFormOf, evidenceItemOf, type EvidenceForm } from '../../model/evidence-form';
import { newItemId } from '../../model/rca-form';
import { useCaseWorkspace } from '../case-context';
import { useCasePatch } from '../use-case-patch';
import { AttachmentsField } from './attachments-field';
import { EvidenceClassificationFields, EvidenceDetailsFields, EvidenceTaskFields } from './evidence-fields';
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
    };
    const item = evidenceItemOf(form, base);
    const evidence = existing ? rca.evidence.map((entry) => (entry.id === existing.id ? item : entry)) : [...rca.evidence, item];
    const result = await patch.save({ evidence }).catch(() => null);
    if (result) navigate(`${basePath}/evidence/${encodeURIComponent(item.id)}`, { replace: true });
  };
  return { save, error: patch.error, isPending: patch.isPending };
}

/** `/rca/:caseId/evidence/new` and `…/:evidenceId/edit`: the evidence form with files and historian query. */
export function EvidenceFormPage() {
  const { rca, readOnly, basePath } = useCaseWorkspace();
  const { timezone } = useRcaFormat();
  const { evidenceId } = useParams();
  const navigate = useNavigate();
  const existing = evidenceId ? rca.evidence.find((entry) => entry.id === evidenceId) : undefined;
  const [form, setForm] = useState<EvidenceForm>(() => (existing ? evidenceFormOf(existing, timezone) : EMPTY_EVIDENCE_FORM));
  const [busy, setBusy] = useState(false);
  const saving = useEvidenceSave(existing);
  if (readOnly || (evidenceId && !existing)) return <Navigate to={`${basePath}/evidence`} replace />;
  const change = (patch: Partial<EvidenceForm>) => setForm((current) => ({ ...current, ...patch }));
  return (
    <Section title={existing ? `Edit evidence: ${existing.title}` : 'Add evidence'}>
      <form
        className="space-y-6"
        data-testid="evidence-form"
        onSubmit={(e) => {
          e.preventDefault();
          void saving.save(form);
        }}
      >
        <EvidenceDetailsFields form={form} onChange={change} />
        {form.type === 'Time Series' && <SeriesFields value={form.series} onChange={(series) => change({ series })} />}
        <EvidenceClassificationFields form={form} onChange={change} />
        <EvidenceTaskFields form={form} onChange={change} />
        <AttachmentsField rcaId={rca.id} value={form.attachments} onChange={(attachments) => change({ attachments })} onBusy={setBusy} />
        {saving.error ? <FriendlyErrorAlert error={saving.error} /> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={form.title.trim() === '' || busy || saving.isPending} data-testid="save-evidence">
            {existing ? 'Save evidence' : 'Add evidence'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(existing ? `${basePath}/evidence/${encodeURIComponent(existing.id)}` : `${basePath}/evidence`)}>
            Cancel
          </Button>
        </div>
      </form>
    </Section>
  );
}
