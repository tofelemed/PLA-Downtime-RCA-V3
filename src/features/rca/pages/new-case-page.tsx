import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreateRcaCase } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { useRcaFormat } from '../use-rca-format';
import { buildCreateBody, emptyCaseForm, type RcaCaseForm } from '../model/rca-form';
import { readStartRca, type StartRcaContext } from '../model/start-rca';
import { EventCaseSection } from './event-case-section';
import { NewCaseFields } from './new-case-form';
import { LossLineFollowUpError } from './loss-line-follow-up-error';
import { useLossLineFollowUp } from './use-loss-line-follow-up';

const prefilledForm = (start: StartRcaContext): RcaCaseForm => ({
  ...emptyCaseForm(start.unitId ?? null),
  title: start.title ?? '',
  description: start.description ?? '',
});

function StandaloneCase({ start }: { start: StartRcaContext }) {
  const navigate = useNavigate();
  const create = useCreateRcaCase();
  const followUp = useLossLineFollowUp(start.lossLineId);
  const { timezone } = useRcaFormat();
  const [form, setForm] = useState<RcaCaseForm>(() => prefilledForm(start));
  const submit = async () => {
    const created = await create.submit(buildCreateBody(form, timezone)).catch(() => null);
    if (created) await followUp.finish(created.id);
  };
  const busy = create.isPending || followUp.isPending || followUp.unlinkedCaseId !== null;
  return (
    <Section title="Investigation">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <NewCaseFields form={form} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
        {create.error ? <FriendlyErrorAlert error={create.error} /> : null}
        <LossLineFollowUpError error={followUp.error} caseId={followUp.unlinkedCaseId} />
        <div className="flex gap-2">
          <Button type="submit" disabled={form.title.trim() === '' || busy} data-testid="create-case">
            {start.lossLineId ? 'Create investigation and link the loss line' : 'Create investigation'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/rca')}>
            Cancel
          </Button>
        </div>
      </form>
    </Section>
  );
}

const DESCRIPTIONS = {
  event: 'Add the event to an existing investigation or open a new one. The link stores the evidence package; it never codes the event or changes its loss.',
  lossLine: 'The new investigation is linked to the loss line, with its approved impact in the evidence package.',
  standalone: 'The investigation starts as Draft. Link events, approved loss lines or work orders from it afterwards.',
};

/**
 * `/rca/new`: opens a case. `?eventId=` (Event Hub, loss lines with a cause event) links the event to an
 * existing case or a new one with its evidence package; `?lossLineId=` also links that loss line; the
 * Pareto and bad-actor actions prefill `title`, `description` and `unitId`. Starts as Draft.
 */
export function NewCasePage() {
  const tenantId = useV2TenantId();
  const { canWriteRca } = useCapabilities();
  const [params] = useSearchParams();
  const start = readStartRca(params);
  const eventId = start.eventId;
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to open an investigation." />;
  if (!canWriteRca) return <DataState state="no-permission" detail="Only reliability engineers and manager approvers open investigations." />;
  return (
    <Page>
      <PageHeader
        title={eventId ? 'Investigate an event' : 'New investigation'}
        description={eventId ? DESCRIPTIONS.event : start.lossLineId ? DESCRIPTIONS.lossLine : DESCRIPTIONS.standalone}
        back={eventId ? { to: `/events/${encodeURIComponent(eventId)}`, label: 'Back to the stop' } : { to: '/rca', label: 'Investigations' }}
      />
      {eventId ? (
        <EventCaseSection eventId={eventId} initialMode={params.get('mode') === 'existing' ? 'existing' : 'new'} lossLineId={start.lossLineId} />
      ) : (
        <StandaloneCase start={start} />
      )}
    </Page>
  );
}
