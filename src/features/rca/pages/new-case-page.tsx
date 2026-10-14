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
import { EventCaseSection } from './event-case-section';
import { NewCaseFields } from './new-case-form';

function StandaloneCase() {
  const navigate = useNavigate();
  const create = useCreateRcaCase();
  const { timezone } = useRcaFormat();
  const [form, setForm] = useState<RcaCaseForm>(() => emptyCaseForm(null));
  const submit = async () => {
    const created = await create.submit(buildCreateBody(form, timezone)).catch(() => null);
    if (created) navigate(`/rca/${created.id}`, { replace: true });
  };
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
        <div className="flex gap-2">
          <Button type="submit" disabled={form.title.trim() === '' || create.isPending} data-testid="create-case">
            Create case
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/rca')}>
            Cancel
          </Button>
        </div>
      </form>
    </Section>
  );
}

/**
 * `/rca/new` (`?eventId=` from the Event Hub): opens a case, or — for an event — links it to an existing
 * case or a new one with the event's evidence package. Starts as Draft; the event's RCA state becomes linked.
 */
export function NewCasePage() {
  const tenantId = useV2TenantId();
  const { canWriteRca } = useCapabilities();
  const [params] = useSearchParams();
  const eventId = params.get('eventId');
  if (!tenantId) return <DataState state="no-permission" detail="Choose a plant to open an RCA case." />;
  if (!canWriteRca) return <DataState state="no-permission" detail="Only reliability engineers and manager approvers open RCA cases." />;
  return (
    <Page>
      <PageHeader
        title={eventId ? 'Investigate an event' : 'New RCA case'}
        description={
          eventId
            ? 'Add the event to an existing case or open a new one. The link stores the evidence package; it never codes the event or changes its loss.'
            : 'The case starts as Draft. Link events, approved loss lines or work orders from the case afterwards.'
        }
        back={{ to: '/rca', label: 'RCA cases' }}
      />
      {eventId ? <EventCaseSection eventId={eventId} /> : <StandaloneCase />}
    </Page>
  );
}
