import { useState } from 'react';
import type { RcaEvidenceItem, RcaRecommendationItem } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { newItemId } from '../model/rca-form';

interface ItemsEditorProps<T extends { id: string; title: string }> {
  heading: string;
  testId: string;
  items: T[];
  detailOf: (item: T) => string;
  create: (id: string, title: string, detail: string) => T;
  detailLabel: string;
  onChange: (items: T[]) => void;
}

function ItemsEditor<T extends { id: string; title: string }>(props: ItemsEditorProps<T>) {
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const add = () => {
    props.onChange([...props.items, props.create(newItemId(props.testId, props.items), title.trim(), detail.trim())]);
    setTitle('');
    setDetail('');
  };
  return (
    <fieldset className="space-y-2 rounded border p-2" data-testid={props.testId}>
      <legend className="px-1 text-sm font-medium">{props.heading}</legend>
      <ul className="space-y-1 text-sm">
        {props.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2">
            <span>
              {item.title} <span className="text-muted-foreground">{props.detailOf(item)}</span>
            </span>
            <Button size="sm" variant="ghost" aria-label={`Remove ${item.title}`} onClick={() => props.onChange(props.items.filter((i) => i.id !== item.id))}>
              Remove
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Title" aria-label={`${props.heading} title`} value={title} maxLength={255} onChange={(e) => setTitle(e.target.value)} />
        <Input className="max-w-xs" placeholder={props.detailLabel} aria-label={`${props.heading} ${props.detailLabel}`} value={detail} onChange={(e) => setDetail(e.target.value)} />
        <Button size="sm" variant="outline" disabled={title.trim() === ''} onClick={add}>Add</Button>
      </div>
    </fieldset>
  );
}

const orNull = (value: string) => (value === '' ? null : value);

export function RecommendationItemsEditor({ items, onChange }: { items: RcaRecommendationItem[]; onChange: (items: RcaRecommendationItem[]) => void }) {
  return (
    <ItemsEditor
      heading="Recommendations"
      testId="rec"
      items={items}
      detailLabel="Description"
      detailOf={(item) => [item.status, item.description].filter(Boolean).join(' · ')}
      create={(id, title, detail) => ({ id, title, description: orNull(detail), priority: null, ownerId: null, dueDate: null, status: 'open' })}
      onChange={onChange}
    />
  );
}

export function EvidenceItemsEditor({ items, onChange }: { items: RcaEvidenceItem[]; onChange: (items: RcaEvidenceItem[]) => void }) {
  return (
    <ItemsEditor
      heading="Evidence"
      testId="ev"
      items={items}
      detailLabel="Source (tag, document, photo)"
      detailOf={(item) => [item.type, item.source].filter(Boolean).join(' · ')}
      create={(id, title, detail) => ({ id, title, description: null, type: null, source: orNull(detail), collectedAt: null, collectedBy: null })}
      onChange={onChange}
    />
  );
}
