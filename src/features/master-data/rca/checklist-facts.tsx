import type { VerificationChecklistView } from '../api/master-data-types';
import { useNumberFormat } from '@/features/ux-kit/use-number-format';
import { ColorSwatch } from './color-swatch';
import { FactsList } from './facts-list';

/** A checklist's details for readers and retired checklists: the fields and its numbered items as text. */
export function ChecklistFacts({ checklist }: { checklist: VerificationChecklistView }) {
  const { number } = useNumberFormat();
  const items = checklist.items.length ? (
    <ol className="space-y-0.5">
      {checklist.items.map((item, index) => (
        <li key={`${index}-${item}`}>
          {number(index + 1)}. {item}
        </li>
      ))}
    </ol>
  ) : (
    '—'
  );
  return (
    <FactsList
      testId="checklist-facts"
      facts={[
        { label: 'Name', value: checklist.name },
        { label: 'Code', value: checklist.code },
        { label: 'Description', value: checklist.description || '—' },
        { label: 'Badge colour', value: <span className="inline-flex items-center gap-2"><ColorSwatch color={checklist.color} />{checklist.color ?? '—'}</span> },
        { label: 'Items', value: items },
      ]}
    />
  );
}
