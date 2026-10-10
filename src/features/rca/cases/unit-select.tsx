import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnitNames } from '../use-unit-names';

const TENANT_WIDE = 'tenant';

/** Unit scope of a case; "Tenant-wide" needs a tenant-wide grant (the server answers 403 otherwise). */
export function UnitSelect({ id, value, onChange }: { id: string; value: string | null; onChange: (unitId: string | null) => void }) {
  const { units } = useUnitNames();
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Unit</Label>
      <Select value={value ?? TENANT_WIDE} onValueChange={(next) => onChange(next === TENANT_WIDE ? null : next)}>
        <SelectTrigger id={id} aria-label="Unit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TENANT_WIDE}>Tenant-wide</SelectItem>
          {units.map((unit) => (
            <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
