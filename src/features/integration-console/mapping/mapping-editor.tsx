import { useAttributePreview, useFieldCatalog, useSaveAttributeMapping } from '@/api/v2/queries/integration-mappings';
import type { SampleRecordView } from '@/api/v2/types/integrations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ConsoleRefusal } from '../components/console-refusal';
import { SourceRef } from '../components/source-ref';
import { useMappingDraft } from '../hooks/use-mapping-draft';
import { NO_TEMPLATE, previewBody } from '../model/mapping-draft';
import { MappingPreview } from './mapping-preview';
import { MappingRulesTable } from './mapping-rules-table';

export interface MappingEditorProps {
  connectionId: string;
  sample: SampleRecordView;
  timezone: string;
}

/**
 * Attribute → event field mapping of the sample's template (ING04, PI02): effective rules from the shared
 * catalog, field-by-field edits as a draft, a server preview of the sample under the draft, then the
 * next override version for this connection (nothing changes until saved).
 */
export function MappingEditor({ connectionId, sample, timezone }: MappingEditorProps) {
  const templateName = sample.templateName ?? NO_TEMPLATE;
  const catalog = useFieldCatalog();
  const mapping = useMappingDraft(connectionId, templateName);
  const preview = useAttributePreview();
  const save = useSaveAttributeMapping();
  const overrideFields = new Set((mapping.effective?.override?.fieldRules ?? []).map((rule) => rule.targetField));
  const runPreview = () => void preview.submit(previewBody({ sample, connectionId, templateName, draft: mapping.changed })).catch(() => null);
  const saveVersion = async () => {
    const saved = await save.submit({ templateName, connectionId, fieldRules: mapping.changed.map((rule) => ({ ...rule })) }).catch(() => null);
    if (saved) preview.reset();
  };
  const state = dataStateOf(mapping.query);
  return (
    <section aria-label="Mapping editor" className="space-y-3" data-testid="mapping-editor" data-template={templateName}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">Mapping: {templateName}</h3>
        {mapping.effective && <Badge variant="secondary">{mapping.effective.eventType}</Badge>}
        {mapping.effective?.override && <Badge variant="outline">override v{mapping.effective.override.version} in force</Badge>}
        <span className="text-xs text-muted-foreground">sample <SourceRef value={sample.sourceObjectId} /></span>
      </div>
      <DataState state={state} error={mapping.query.error}>
        <MappingRulesTable draft={mapping.draft} changed={mapping.changed} overrideFields={overrideFields} catalog={catalog.data?.fields ?? []} onPatch={mapping.patch} />
      </DataState>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={runPreview} disabled={preview.isPending} data-testid="mapping-preview-run">
          Preview sample
        </Button>
        <Button size="sm" variant="outline" disabled={mapping.changed.length === 0 || save.isPending} onClick={() => void saveVersion()} data-testid="mapping-save">
          Save {mapping.changed.length} change(s) as a new version
        </Button>
        <Button size="sm" variant="ghost" disabled={mapping.changed.length === 0} onClick={mapping.reset}>
          Discard draft
        </Button>
      </div>
      {save.data && !save.isPending && (
        <p className="text-sm" role="status" data-testid="mapping-saved">
          Saved override v{save.data.version} for {save.data.templateName}; replay quarantined records to apply it to them.
        </p>
      )}
      <ConsoleRefusal error={preview.error ?? save.error} />
      {preview.data && <MappingPreview preview={preview.data} timezone={timezone} />}
    </section>
  );
}
