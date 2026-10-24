import { Label } from '@/components/ui/label';
import { FIELD_CLASS, SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import type { OpenFilter } from '../model/event-filters';

const OPTIONS: ReadonlyArray<{ value: OpenFilter; label: string }> = [
  { value: 'any', label: 'Ongoing and ended' },
  { value: 'open', label: 'Ongoing only' },
  { value: 'closed', label: 'Ended only' },
];

const isOpenFilter = (value: string): value is OpenFilter => OPTIONS.some((option) => option.value === value);

/** Ongoing / ended filter of the event list, its label stacked above the select. */
export function OpenSelect({ value, onChange }: { value: OpenFilter; onChange: (value: OpenFilter) => void }) {
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor="filter-open">Ongoing or ended</Label>
      <select
        id="filter-open"
        data-testid="filter-open"
        className={SELECT_CLASS}
        value={value}
        onChange={(event) => {
          if (isOpenFilter(event.target.value)) onChange(event.target.value);
        }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
