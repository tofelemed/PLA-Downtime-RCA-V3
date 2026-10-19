import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OWNER_STATUS_LABELS, OWNER_STATUSES, type OwnerStatus } from '../model/action-queue-filters';

export interface OwnerStatusFilterProps {
  id: string;
  value: OwnerStatus;
  onChange: (next: OwnerStatus) => void;
}

/** "Status" of an owner's RCA actions: still to do, done, or all (Marun G2, QA L16). */
export function OwnerStatusFilter({ id, value, onChange }: OwnerStatusFilterProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Status</Label>
      <Select value={value} onValueChange={(next) => onChange(OWNER_STATUSES.find((s) => s === next) ?? 'open')}>
        <SelectTrigger id={id} className="w-full sm:w-56" data-testid="owner-action-status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OWNER_STATUSES.map((status) => (
            <SelectItem key={status} value={status}>
              {OWNER_STATUS_LABELS[status]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
