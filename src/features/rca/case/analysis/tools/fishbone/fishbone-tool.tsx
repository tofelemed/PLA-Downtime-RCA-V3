import { useState } from 'react';
import type { FishboneCategory, FishboneContent } from '@/api/v2/types/rca-analyses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { IconButton } from '@/features/ux-kit/icon-button';
import { ActionIcon } from '@/lib/icons';
import { ANALYSIS_SETTINGS, rowId } from '../../../../model/analysis-settings';
import { useCaseWorkspace } from '../../../case-context';
import { CopyReportButton } from '../copy-report-button';
import { SaveBar, ToolFrame, type ToolRecord } from '../tool-record';
import { AddCauseDialog, type NewCause } from './add-cause-dialog';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';

const defaultCategories = (): FishboneCategory[] =>
  ANALYSIS_SETTINGS.fishbone.categories.map((name, index) => ({ id: `cat-${index + 1}`, name, causes: [] }));

function report(content: FishboneContent): string {
  const lines = content.categories.flatMap((category) => [
    `${category.name}:`,
    ...(category.causes.length ? category.causes.map((c, i) => `  ${i + 1}. ${c.description}${c.isPrimary ? ' [primary]' : ''} (${c.likelihood} likelihood)`) : ['  (none)']),
  ]);
  return ['FISHBONE DIAGRAM', '', `Effect: ${content.effect}`, '', ...lines].join('\n');
}

function CategoryCard(props: { category: FishboneCategory; readOnly: boolean; onAdd: () => void; onChange: (next: FishboneCategory) => void }) {
  const { number } = useNumberFormat();
  const { category, readOnly } = props;
  const update = (causes: FishboneCategory['causes']) => props.onChange({ ...category, causes });
  return (
    <section className="space-y-2 rounded border p-3" aria-label={category.name} data-testid="fishbone-category">
      <h4 className="flex items-center justify-between text-sm font-semibold">
        {category.name} <Badge variant="outline">{number(category.causes.length)}</Badge>
      </h4>
      {category.causes.length === 0 && <p className="text-xs text-muted-foreground">No causes yet.</p>}
      <ul className="space-y-1 text-sm">
        {category.causes.map((cause) => (
          <li key={cause.id} className="flex items-start justify-between gap-2 rounded bg-muted/40 p-2">
            <span>
              {cause.description}
              <span className="block text-xs text-muted-foreground">
                {cause.likelihood} likelihood{cause.isPrimary ? ' · primary' : ''}
              </span>
            </span>
            {!readOnly && (
              <span className="flex">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={cause.isPrimary}
                  onClick={() => update(category.causes.map((c) => (c.id === cause.id ? { ...c, isPrimary: !c.isPrimary } : c)))}
                >
                  {cause.isPrimary ? 'Make secondary' : 'Make primary'}
                </Button>
                <IconButton icon={ActionIcon.delete} label={`Remove cause ${cause.description}`} onClick={() => update(category.causes.filter((c) => c.id !== cause.id))} />
              </span>
            )}
          </li>
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" onClick={props.onAdd}>
          Add cause
        </Button>
      )}
    </section>
  );
}

function Editor({ record, save }: { record: ToolRecord<'fishbone'>; save: (body: FishboneContent) => Promise<unknown> }) {
  const { number } = useNumberFormat();
  const { rca, readOnly } = useCaseWorkspace();
  const [content, setContent] = useState<FishboneContent>(() => ({ effect: record?.effect ?? rca.title, categories: record?.categories ?? defaultCategories() }));
  const [adding, setAdding] = useState<FishboneCategory | null>(null);
  const causes = content.categories.flatMap((category) => category.causes);
  const replace = (next: FishboneCategory) => setContent({ ...content, categories: content.categories.map((c) => (c.id === next.id ? next : c)) });
  const add = (category: FishboneCategory, cause: NewCause) => {
    replace({ ...category, causes: [...category.causes, { id: rowId('cause', causes), ...cause }] });
    setAdding(null);
  };
  return (
    <div className="space-y-4" data-testid="fishbone-tool">
      <div className="space-y-1">
        <Label htmlFor="fishbone-effect">Effect (the problem at the fish head)</Label>
        <Input id="fishbone-effect" value={content.effect} maxLength={1000} disabled={readOnly} onChange={(e) => setContent({ ...content, effect: e.target.value })} />
      </div>
      <p className="text-sm text-muted-foreground">
        {number(causes.length)} cause(s), {number(causes.filter((c) => c.isPrimary).length)} primary, {number(causes.filter((c) => c.likelihood === 'High').length)} of high likelihood.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {content.categories.map((category) => (
          <CategoryCard key={category.id} category={category} readOnly={readOnly} onAdd={() => setAdding(category)} onChange={replace} />
        ))}
      </div>
      {adding && <AddCauseDialog category={adding.name} onAdd={(cause) => add(adding, cause)} onClose={() => setAdding(null)} />}
      <div className="flex flex-wrap items-start gap-3">
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
