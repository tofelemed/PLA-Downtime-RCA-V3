import { useState } from 'react';
import type { FishboneCategory, FishboneContent } from '@/api/v2/types/rca-analyses';
import { plural } from '@/features/ux-kit/format/plural';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ANALYSIS_SETTINGS, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { CopyReportButton } from '../copy-report-button';
import { ToolCanvas } from '../tool-canvas';
import { useToolDraft } from '../tool-draft';
import { ToolTextField } from '../tool-fields';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { AddCauseDialog, type NewCause } from './add-cause-dialog';
import { FishboneCategoryCard } from './fishbone-category';

const defaultCategories = (): FishboneCategory[] =>
  ANALYSIS_SETTINGS.fishbone.categories.map((name, index) => ({ id: `cat-${index + 1}`, name, causes: [] }));

function report(content: FishboneContent): string {
  const lines = content.categories.flatMap((category) => [
    `${category.name}:`,
    ...(category.causes.length ? category.causes.map((c, i) => `  ${i + 1}. ${c.description}${c.isPrimary ? ' [primary]' : ''} (${c.likelihood} likelihood)`) : ['  (none)']),
  ]);
  return ['FISHBONE DIAGRAM', '', `Effect: ${content.effect}`, '', ...lines].join('\n');
}

function Summary({ content }: { content: FishboneContent }) {
  const { number } = useNumberFormat();
  const causes = content.categories.flatMap((category) => category.causes);
  return (
    <p className="text-sm text-muted-foreground" data-testid="fishbone-summary">
      {plural(causes.length, 'cause', 'causes', number)}, {number(causes.filter((c) => c.isPrimary).length)} primary, {number(causes.filter((c) => c.likelihood === 'High').length)} of high likelihood
    </p>
  );
}

function Editor({ record, save }: { record: ToolRecord<'fishbone'>; save: (body: FishboneContent) => Promise<unknown> }) {
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useToolDraft<FishboneContent>(() => ({ effect: record?.effect ?? rca.title, categories: record?.categories ?? defaultCategories() }));
  const [adding, setAdding] = useState<FishboneCategory | null>(null);
  const causes = content.categories.flatMap((category) => category.causes);
  const replace = (next: FishboneCategory) => setContent({ ...content, categories: content.categories.map((c) => (c.id === next.id ? next : c)) });
  const add = (category: FishboneCategory, cause: NewCause) => {
    replace({ ...category, causes: [...category.causes, { id: rowId('cause', causes), ...cause }] });
    setAdding(null);
  };
  return (
    <div className="space-y-4" data-testid="fishbone-tool">
      <ToolTextField id="fishbone-effect" label="Effect (the problem at the fish head)" value={content.effect} maxLength={1000} onChange={(effect) => setContent({ ...content, effect })} />
      <ToolCanvas label="Fishbone diagram" toolbar={<Summary content={content} />}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {content.categories.map((category) => (
            <FishboneCategoryCard key={category.id} category={category} readOnly={readOnly} onAdd={() => setAdding(category)} onChange={replace} />
          ))}
        </div>
      </ToolCanvas>
      {adding && <AddCauseDialog category={adding.name} onAdd={(cause) => add(adding, cause)} onClose={() => setAdding(null)} />}
      <div className="flex flex-wrap items-start justify-between gap-3 border-t pt-3">
        <SaveBar onSave={() => save(content)} disabled={content.effect.trim() === '' || causes.length === 0} hint="Name the effect and add at least one cause." label="Save fishbone" updatedAt={record?.updatedAt} />
        <CopyReportButton text={() => report(content)} disabled={causes.length === 0} />
      </div>
    </div>
  );
}

/** Fishbone (Ishikawa): causes grouped by the 6M categories, primary causes marked. */
export function FishboneTool() {
  return <ToolFrame tool="fishbone">{(record, save) => <Editor record={record} save={save} />}</ToolFrame>;
}
