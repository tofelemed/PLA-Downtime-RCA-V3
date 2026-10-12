import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConnections } from '@/api/v2/queries/integration-connections';
import { useCreateSourceMapping, useReplaceSourceMapping, useSourceMapping } from '@/api/v2/queries/integration-mappings';
import type { SourceMappingView } from '@/api/v2/types/integration-mappings';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { ConsoleRefusal } from '../components/console-refusal';
import { MappingFormFields } from '../mapping/mapping-form-fields';
import { MappingTest } from '../mapping/mapping-test';
import { emptyMappingForm, mappingBody, mappingFormErrors, mappingFormOf, type MappingForm, type MappingFormErrors } from '../model/mapping-form';
import { consolePath } from '../paths';

const LIST = consolePath('mappings');

function MappingEditor({ rule }: { rule: SourceMappingView | null }) {
  const navigate = useNavigate();
  const { timezone } = usePlantTimezone();
  const { canWriteIntegration } = useCapabilities();
  const connections = useConnections(true);
  const [form, setForm] = useState<MappingForm>(() => (rule ? mappingFormOf(rule) : emptyMappingForm()));
  const [errors, setErrors] = useState<MappingFormErrors>({});
  const create = useCreateSourceMapping();
  const replace = useReplaceSourceMapping();
  const save = async () => {
    const problems = mappingFormErrors(form);
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;
    const type = connections.items.find((connection) => connection.id === form.connectionId)?.sourceType ?? null;
    const body = mappingBody(form, type);
    const saved = rule ? await replace.submit({ mapping: rule, body }).catch(() => null) : await create.submit(body).catch(() => null);
    if (saved) navigate(LIST);
  };
  return (
    <div className="space-y-6" data-testid="mapping-editor-page">
      {rule?.legacyMappingId && (
        <p className="text-sm text-muted-foreground">This rule came from the former hierarchy mapping screen. Saving it here makes it a regular rule of this list.</p>
      )}
      <Section title="Rule">
        <fieldset disabled={!canWriteIntegration} className="space-y-4">
          <MappingFormFields form={form} errors={errors} connections={connections.items} timezone={timezone} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} />
        </fieldset>
      </Section>
      <ConsoleRefusal error={create.error ?? replace.error} />
      {canWriteIntegration && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void save()} disabled={create.isPending || replace.isPending} data-testid="mapping-save-rule">
            {rule ? 'Save as next version' : 'Create rule'}
          </Button>
          <Button variant="outline" onClick={() => navigate(LIST)}>
            Cancel
          </Button>
        </div>
      )}
      <Section title="Test resolution" description="Resolve a source value against the rules as saved now." collapsible defaultOpen={false}>
        <MappingTest connectionId={form.connectionId} initial={form.matchKind === 'pattern' ? '' : form.matchValue} />
      </Section>
    </div>
  );
}

/** `/connectivity/mappings/new` and `/connectivity/mappings/:mappingId`: create or edit one source → plant rule. */
export function SourceMappingEditorPage() {
  const { mappingId } = useParams();
  const query = useSourceMapping(mappingId ?? null);
  const title = mappingId ? 'Edit mapping rule' : 'New mapping rule';
  return (
    <Page>
      <PageHeader title={title} description="Which unit or asset records from a source belong to." back={{ to: LIST, label: 'Source mappings' }} />
      {mappingId ? (
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {query.data && <MappingEditor key={`${query.data.id}-${query.data.rowVersion}`} rule={query.data} />}
        </DataState>
      ) : (
        <MappingEditor rule={null} />
      )}
    </Page>
  );
}
