import { useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';
import type { ViewMode } from '../model/view-modes';
import { FIELD_CLASS, SELECT_CLASS } from './analytics-filters';

export interface ModeFieldProps {
  param: string;
  label: string;
  options: readonly ViewMode[];
}

/**
 * What a PLA page shows, as a filter-bar field (label above, h-9): the URL keeps the choice for Back and
 * shared links; the first option is the default and leaves the parameter out.
 */
export function ModeField({ param, label, options }: ModeFieldProps) {
  const [params, setParams] = useSearchParams();
  const value = options.find((option) => option.value === params.get(param))?.value ?? options[0].value;
  const choose = (next: string) =>
    setParams((current) => {
      const copy = new URLSearchParams(current);
      if (next === options[0].value) copy.delete(param);
      else copy.set(param, next);
      return copy;
    });
  return (
    <div className={FIELD_CLASS}>
      <Label htmlFor={`analysis-${param}`}>{label}</Label>
      <select id={`analysis-${param}`} value={value} className={SELECT_CLASS} onChange={(event) => choose(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
