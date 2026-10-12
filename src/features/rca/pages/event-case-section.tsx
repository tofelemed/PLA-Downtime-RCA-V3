import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEventRcaEvidence } from '@/api/v2/queries/rca-cases';
import { useLinkEventToRca } from '@/api/v2/queries/rca-commands';
import type { EventEvidencePackageView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { SimilarKnowledgePanel } from '@/features/rca-knowledge/similar-knowledge-panel';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Section } from '@/features/ux-kit/page-layout';
import { EvidenceView } from '../components/evidence-view';
import { CaseSearch } from '../link-dialog/case-search';
import { buildCreateBody, emptyCaseForm, type RcaCaseForm } from '../model/rca-form';
import { useRcaFormat } from '../use-rca-format';
import { NewCaseFields } from './new-case-form';

type Mode = 'new' | 'existing';

function ModeChoice({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <RadioGroup value={mode} onValueChange={(value) => onChange(value === 'existing' ? 'existing' : 'new')} className="flex flex-wrap gap-4" aria-label="Case">
      <div className="flex items-center gap-2">
        <RadioGroupItem id="mode-new" value="new" />
        <Label htmlFor="mode-new">Open a new case</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="mode-existing" value="existing" />
        <Label htmlFor="mode-existing">Add to an existing case</Label>
      </div>
    </RadioGroup>
  );
}

function useLinkSubmit(eventId: string, evidence: EventEvidencePackageView | undefined) {
  const navigate = useNavigate();
  const link = useLinkEventToRca();
  const submit = async (input: { mode: Mode; form: RcaCaseForm; selected: string | null; reason: string }) => {
    const reason = input.reason.trim() || undefined;
    const body =
      input.mode === 'existing'
        ? { rcaId: input.selected ?? '', reason }
        : { create: { ...buildCreateBody(input.form), unitId: evidence?.event.unitId ?? input.form.unitId }, reason };
    const result = await link.submit({ eventId, body }).catch(() => null);
    if (result) navigate(`/rca/${result.rca.id}`, { replace: true });
  };
  return { submit, error: link.error, isPending: link.isPending };
}

/** The event-driven part of `/rca/new?eventId=`: evidence preview, new or existing case, similar RCAs. */
export function EventCaseSection({ eventId }: { eventId: string }) {
  const { timezone } = useRcaFormat();
  const evidence = useEventRcaEvidence(eventId);
  const [mode, setMode] = useState<Mode>('new');
  const [form, setForm] = useState<RcaCaseForm>(() => emptyCaseForm(null));
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const link = useLinkSubmit(eventId, evidence.data);
  const event = evidence.data?.event;
  const ready = mode === 'existing' ? selected !== null : form.title.trim() !== '';
  return (
    <>
      <Section title="Evidence package" description="Stored with the link: revisions, cause codes, trend window, recurrence and approved impact.">
        <DataState state={dataStateOf(evidence)} error={evidence.error} onRetry={() => evidence.refetch()}>
          {evidence.data && <EvidenceView evidence={{ ...evidence.data }} timezone={timezone} />}
        </DataState>
      </Section>
      <Section title="Case" description="Linking twice is harmless: an existing link is kept.">
        <div className="space-y-4" data-testid="link-rca-form">
          <ModeChoice mode={mode} onChange={setMode} />
          {mode === 'new' ? (
            <NewCaseFields form={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} unitLocked />
          ) : event ? (
            <CaseSearch
              context={{ assetId: event.assetId, reasonCodeId: evidence.data?.causeCodes.reasonCode?.id ?? null, from: event.start, to: event.end ?? event.start }}
              selectedId={selected}
              onSelect={setSelected}
            />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="link-reason">Why this link (optional)</Label>
            <Textarea id="link-reason" value={reason} maxLength={2000} onChange={(e) => setReason(e.target.value)} />
          </div>
          {link.error ? <FriendlyErrorAlert error={link.error} /> : null}
          <Button disabled={!ready || link.isPending} onClick={() => void link.submit({ mode, form, selected, reason })} data-testid="link-rca-submit">
            {mode === 'existing' ? 'Link to case' : 'Create case and link'}
          </Button>
        </div>
      </Section>
      <Section title="Similar past RCAs" collapsible>
        <SimilarKnowledgePanel eventId={eventId} />
      </Section>
    </>
  );
}
