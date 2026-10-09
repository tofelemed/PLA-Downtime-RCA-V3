import { Label } from '@/components/ui/label';
import { useCodeLibrary } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';

export interface ReasonSelectProps {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (reasonCodeId: string) => void;
}

/** Reason codes of the tenant in path order (plan 1.3 tree), as a native select (UX07). */
export function ReasonSelect({ id, value, disabled, onChange }: ReasonSelectProps) {
  const codes = useCodeLibrary('reason-codes');
  const ordered = flattenPages(codes.data?.pages).sort((a, b) => a.path.localeCompare(b.path));
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Reason code</Label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
        <option value="">— choose —</option>
        {ordered.map((code) => (
          <option key={code.id} value={code.id}>
            {`${'  '.repeat(Math.max(0, code.level - 1))}${code.code} · ${code.name}`}
          </option>
        ))}
      </select>
    </div>
  );
}
