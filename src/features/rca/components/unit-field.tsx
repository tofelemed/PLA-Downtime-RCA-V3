import type { MasterUnitView } from '@/features/master-data/api/master-data-types';
import { UNITS } from '@/features/master-data/api/record-resource';
import { useRecordLookup } from '@/features/master-data/api/use-record-queries';
import { SelectField } from './select-field';

export interface UnitFieldProps {
  id: string;
  /** '' = every unit of your scope */
  value: string;
  onChange: (unitId: string) => void;
}

/** The plant's active units by code as a filter-bar select, "All units" first (emits ''). */
export function UnitField({ id, value, onChange }: UnitFieldProps) {
  const units = useRecordLookup<MasterUnitView>(UNITS, { status: 'active', sort: 'code' });
  const options = units.items.map((unit) => ({ value: unit.id, label: `${unit.code} — ${unit.name}` }));
  return <SelectField id={id} label="Unit" value={value} options={options} onChange={onChange} placeholder="All units" />;
}
