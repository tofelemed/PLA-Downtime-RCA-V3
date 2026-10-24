import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DebouncedSearchInput } from '@/features/ux-kit/debounced-search-input';

export interface LabelledSearchProps {
  /** accessible name of the box, e.g. "Search codes" */
  label: string;
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
}

/** A filter-bar search box with "Search" stacked above it (h-9), aligned with the bar's other labelled controls. */
export function LabelledSearch({ label, value, onChange, placeholder }: LabelledSearchProps) {
  return (
    <div className={FIELD_CLASS}>
      <p className="text-sm font-medium leading-none" aria-hidden="true">
        Search
      </p>
      <DebouncedSearchInput label={label} placeholder={placeholder ?? label} value={value} onChange={onChange} className="w-full sm:w-72 [&_input]:h-9" />
    </div>
  );
}
