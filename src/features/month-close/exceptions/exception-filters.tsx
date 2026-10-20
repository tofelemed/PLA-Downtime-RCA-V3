import { useUnits } from '@/api/v2/queries/units';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import type { ExceptionType } from '@/api/v2/types/reconciliation-exceptions';
import { Label } from '@/components/ui/label';
import { EXCEPTION_TYPE_LABELS } from './exception-model';

const SELECT = 'flex h-10 rounded-md border border-input bg-background px-3 text-sm';

export interface ExceptionFiltersProps {
  type: ExceptionType | null;
  unitId: string | null;
  onChange: (key: 'problem' | 'unit', value: string) => void;
}

/** Problem type and unit filters; the server filters, the browser only passes the choice on. */
export function ExceptionFilters({ type, unitId, onChange }: ExceptionFiltersProps) {
  const units = flattenPages(useUnits().data?.pages);
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="exception-type">Problem</Label>
        <select id="exception-type" className={SELECT} value={type ?? ''} onChange={(event) => onChange('problem', event.target.value)}>
          <option value="">All problems</option>
          {EXCEPTION_TYPE_LABELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="exception-unit">Unit</Label>
        <select id="exception-unit" className={SELECT} value={unitId ?? ''} onChange={(event) => onChange('unit', event.target.value)}>
          <option value="">All units</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </select>
      </div>
    </div>
  );
}
