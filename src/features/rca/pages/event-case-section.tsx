import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Link } from 'react-router-dom';
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
import { eventCaseProblem, eventCaseTitle, type EventCaseFacts } from '../model/event-case-prefill';
import { buildCreateBody, emptyCaseForm, type RcaCaseForm } from '../model/rca-form';
import { useRcaFormat } from '../use-rca-format';
import { EventHeaderCard } from './event-header-card';
import { NewCaseFields } from './new-case-form';
import { useEventCaseFacts } from './use-event-case-facts';
import { LossLineFollowUpError } from './loss-line-follow-up-error';
import { useLossLineFollowUp } from './use-loss-line-follow-up';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { TITLE_REQUIRED_REASON, useNewCaseGuard } from './use-new-case-guard';

type Mode = 'new' | 'existing';

function ModeChoice({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <RadioGroup value={mode} onValueChange={(value) => onChange(value === 'existing' ? 'existing' : 'new')} className="flex flex-wrap gap-4" aria-label="Investigation">
      <div className="flex items-center gap-2">
        <RadioGroupItem id="mode-new" value="new" />
        <Label htmlFor="mode-new">Open a new investigation</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem id="mode-existing" value="existing" />
        <Label htmlFor="mode-existing">Add to an existing investigation</Label>
      </div>
    </RadioGroup>
  );
}

function useLinkSubmit(eventId: string, evidence: EventEvidencePackageView | undefined, lossLineId: string | null) {
  const { timezone } = useRcaFormat();
  const link = useLinkEventToRca();
  const followUp = useLossLineFollowUp(lossLineId);
  const submit = async (input: { mode: Mode; form: RcaCaseForm; selected: string | null; reason: string }) => {
    const reason = input.reason.trim() || undefined;
    const body =
      input.mode === 'existing'
        ? { rcaId: input.selected ?? '', reason }
        : { create: { ...buildCreateBody(input.form, timezone), unitId: evidence?.event.unitId ?? input.form.unitId }, reason };
    const result = await link.submit({ eventId, body }).catch(() => null);
    if (result) await followUp.finish(result.rca.id);
  };
  return { submit, error: link.error, isPending: link.isPending || followUp.isPending, followUp };
}

/** Prefills the title and problem statement once from the event facts, unless the user typed already. */
function usePrefill(facts: EventCaseFacts | null, setForm: Dispatch<SetStateAction<RcaCaseForm>>) {
  const done = useRef(false);
  useEffect(() => {
    if (!facts || done.current) return;
    done.current = true;
    setForm((current) => ({
      ...current,
      title: current.title === '' ? eventCaseTitle(facts) : current.title,
      description: current.description === '' ? eventCaseProblem(facts) : current.description,
    }));
  }, [facts, setForm]);
}

/** The stop being investigated (once loaded) and the evidence package the link will store. */
function EventFacts({ evidence, facts }: { evidence: ReturnType<typeof useEventRcaEvidence>; facts: EventCaseFacts | null }) {
  const { timezone } = useRcaFormat();
  const event = evidence.data?.event;
  return (
    <>
      {event && facts && (
        <Section title="Stop being investigated">
          <EventHeaderCard event={event} facts={facts} />
        </Section>
      )}
      <Section title="Evidence package" description="Stored with the link: revisions, cause codes, trend window, recurrence and approved impact.">
        <DataState state={dataStateOf(evidence)} error={evidence.error} onRetry={() => evidence.refetch()}>
          {evidence.data && <EvidenceView evidence={{ ...evidence.data }} timezone={timezone} />}
        </DataState>
      </Section>
    </>
  );
}

export interface EventCaseSectionProps {
  eventId: string;
  initialMode?: Mode;
  /** "Start RCA" from a loss line: linked to the case as well, after the event */
  lossLineId?: string | null;
}

/** The event-driven part of `/rca/new?eventId=`: evidence preview, new or existing case, similar RCAs. */
export function EventCaseSection({ eventId, initialMode = 'new', lossLineId = null }: EventCaseSectionProps) {
  const evidence = useEventRcaEvidence(eventId);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [form, setForm] = useState<RcaCaseForm>(() => emptyCaseForm(null));
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const link = useLinkSubmit(eventId, evidence.data, lossLineId);
  useNewCaseGuard(touched && !link.isPending);
  const event = evidence.data?.event;
  const facts = useEventCaseFacts(evidence.data);
  usePrefill(facts, setForm);
  const ready = mode === 'existing' ? selected !== null : form.title.trim() !== '';
  const notReady = ready ? null : mode === 'existing' ? 'Choose the investigation to link to.' : TITLE_REQUIRED_REASON;
  return (
    <>
      <EventFacts evidence={evidence} facts={facts} />
      <Section title="Investigation" description="Linking twice is harmless: an existing link is kept.">
        <div className="space-y-4" data-testid="link-rca-form">
          <ModeChoice mode={mode} onChange={setMode} />
          {mode === 'new' ? (
            <NewCaseFields form={form} onChange={(patch) => { setTouched(true); setForm((current) => ({ ...current, ...patch })); }} unitLocked />
          ) : event ? (
            <CaseSearch
              context={{ assetId: event.assetId, reasonCodeId: evidence.data?.causeCodes.reasonCode?.id ?? null, from: event.start, to: event.end ?? event.start }}
              selectedId={selected}
              onSelect={setSelected}
            />
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="link-reason">Why this link (optional)</Label>
            <Textarea id="link-reason" value={reason} maxLength={2000} onChange={(e) => { setTouched(true); setReason(e.target.value); }} />
          </div>
          {link.error ? <FriendlyErrorAlert error={link.error} /> : null}
          <LossLineFollowUpError error={link.followUp.error} caseId={link.followUp.unlinkedCaseId} />
          <div className="flex flex-wrap gap-2">
            <Button disabled={!ready || link.isPending} aria-describedby={notReady ? 'link-rca-reason' : undefined} onClick={() => void link.submit({ mode, form, selected, reason })} data-testid="link-rca-submit">
              {mode === 'existing' ? 'Link to investigation' : 'Create investigation and link'}
            </Button>
            <Button asChild variant="outline">
              <Link to={`/events/${encodeURIComponent(eventId)}`}>Cancel</Link>
            </Button>
          </div>
          <DisabledReason id="link-rca-reason" reason={notReady} />
        </div>
      </Section>
      <Section title="Similar past investigations" collapsible>
        <SimilarKnowledgePanel eventId={eventId} />
      </Section>
    </>
  );
}
