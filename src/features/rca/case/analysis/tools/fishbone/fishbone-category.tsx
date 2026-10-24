import type { FishboneCategory } from '@/api/v2/types/rca-analyses';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/features/ux-kit/icon-button';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ActionIcon } from '@/lib/icons';

export interface FishboneCategoryProps {
  category: FishboneCategory;
  readOnly: boolean;
  onAdd: () => void;
  onChange: (next: FishboneCategory) => void;
}

type Cause = FishboneCategory['causes'][number];

interface CauseItemProps {
  cause: Cause;
  readOnly: boolean;
  onTogglePrimary: () => void;
  onRemove: () => void;
}

/** One cause of a bone: its words and likelihood, "Primary" in words, and mark / remove while editable. */
function CauseItem({ cause, readOnly, onTogglePrimary, onRemove }: CauseItemProps) {
  return (
    <li className="flex items-start justify-between gap-2 rounded bg-muted/50 p-2">
      <span className="min-w-0">
        {cause.description}
        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {cause.likelihood} likelihood
          {cause.isPrimary && (
            <Badge variant="secondary" className="whitespace-nowrap px-1.5 py-0 text-[11px]">
              Primary
            </Badge>
          )}
        </span>
      </span>
      {!readOnly && (
        <span className="flex shrink-0">
          <Button type="button" size="sm" variant="ghost" aria-pressed={cause.isPrimary} onClick={onTogglePrimary}>
            {cause.isPrimary ? 'Make secondary' : 'Make primary'}
          </Button>
          <IconButton icon={ActionIcon.delete} label={`Remove cause ${cause.description}`} onClick={onRemove} />
        </span>
      )}
    </li>
  );
}

/** One 6M bone: its causes (primary ones marked in words), with add / mark / remove while editable. */
export function FishboneCategoryCard({ category, readOnly, onAdd, onChange }: FishboneCategoryProps) {
  const { number } = useNumberFormat();
  const update = (causes: FishboneCategory['causes']) => onChange({ ...category, causes });
  const togglePrimary = (id: string) => update(category.causes.map((c) => (c.id === id ? { ...c, isPrimary: !c.isPrimary } : c)));
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-md border bg-card p-3" aria-label={category.name} data-testid="fishbone-category">
      <h4 className="flex items-center justify-between gap-2 text-sm font-semibold text-heading">
        {category.name}
        <Badge variant="outline" className="whitespace-nowrap" aria-label={`${category.causes.length} causes`}>
          {number(category.causes.length)}
        </Badge>
      </h4>
      {category.causes.length === 0 && <p className="text-xs text-muted-foreground">No causes yet.</p>}
      <ul className="space-y-1.5 text-sm">
        {category.causes.map((cause) => (
          <CauseItem key={cause.id} cause={cause} readOnly={readOnly} onTogglePrimary={() => togglePrimary(cause.id)} onRemove={() => update(category.causes.filter((c) => c.id !== cause.id))} />
        ))}
      </ul>
      {!readOnly && (
        <Button type="button" size="sm" variant="outline" className="mt-auto h-9 self-start" onClick={onAdd} aria-label={`Add cause to ${category.name}`}>
          <ActionIcon.add aria-hidden="true" className="h-4 w-4" />
          Add cause
        </Button>
      )}
    </section>
  );
}
