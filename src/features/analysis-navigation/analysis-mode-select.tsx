import { useSearchParams } from 'react-router-dom';
import { Label } from '@/components/ui/label';

interface AnalysisModeSelectProps {
  param: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** opt-in: the label above the select (a field of a bottom-aligned filter row) instead of beside it */
  stacked?: boolean;
}

/** A focused analysis inside a page; the URL retains the choice for Back and shared links. */
export function AnalysisModeSelect({ param, label, options, stacked = false }: AnalysisModeSelectProps) {
  const [params, setParams] = useSearchParams();
  const value = options.find((option) => option.value === params.get(param))?.value ?? options[0].value;
  return (
    <div className={stacked ? 'flex flex-col gap-1.5' : 'flex flex-wrap items-center gap-2'}>
      <Label htmlFor={`analysis-${param}`}>{label}</Label>
      <select id={`analysis-${param}`} value={value} className="h-9 rounded-md border border-input bg-background px-2 text-sm" onChange={(event) => setParams((current) => {
        const next = new URLSearchParams(current);
        if (event.target.value === options[0].value) next.delete(param);
        else next.set(param, event.target.value);
        return next;
      })}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}
