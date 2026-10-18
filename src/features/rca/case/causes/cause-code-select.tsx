import type { RcaCaseCauseView } from '@/api/v2/types/rca-causes';
import { FormField } from '@/features/ux-kit/form-field';
import { StatusBadge } from '@/features/ux-kit/status-badge';
import type { RcaCauseView } from '@/features/master-data/api/master-data-types';
import { RCA_CAUSES } from '@/features/master-data/api/record-resource';
import { useRecordLookup } from '@/features/master-data/api/use-record-queries';

export interface CauseCodeSelectProps {
  id: string;
  value: string;
  /** the code already on the cause (kept selectable when it was retired since) */
  assigned: Pick<RcaCaseCauseView, 'causeCodeId' | 'causeCode'> | null;
  onChange: (causeCodeId: string) => void;
}

const optionText = (code: { code: string; name: string }) => `${code.code} — ${code.name}`;

interface KeptCode {
  id: string;
  text: string;
  active: boolean;
}

/** The assigned code when the active list does not hold it (retired since), to keep it selectable by name. */
function keptCode(assigned: CauseCodeSelectProps['assigned'], activeIds: ReadonlySet<string>): KeptCode | null {
  const id = assigned?.causeCodeId;
  const code = assigned?.causeCode;
  if (!id || !code || activeIds.has(id)) return null;
  return { id, text: `${optionText(code)}${code.active ? '' : ' (retired)'}`, active: code.active };
}

/**
 * Item 7: a code of the plant's cause library. Only active codes can be newly assigned; a retired code
 * already on the cause stays shown by name with a "Retired" badge.
 */
export function CauseCodeSelect({ id, value, assigned, onChange }: CauseCodeSelectProps) {
  const codes = useRecordLookup<RcaCauseView>(RCA_CAUSES, { status: 'active', sort: 'code' });
  const kept = keptCode(assigned, new Set(codes.items.map((code) => code.id)));
  const retired = kept !== null && !kept.active && value === kept.id;
  return (
    <FormField id={id} label="Cause code" hint={codes.isLoading ? 'Loading the cause library…' : 'Active codes of the cause library'}>
      <select id={id} className="h-10 w-full rounded border bg-background px-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">No code</option>
        {kept && <option value={kept.id}>{kept.text}</option>}
        {codes.items.map((code) => (
          <option key={code.id} value={code.id}>
            {optionText(code)}
          </option>
        ))}
      </select>
      {retired && (
        <StatusBadge tone="warning" className="mt-1" data-testid="cause-code-retired">
          Retired
        </StatusBadge>
      )}
    </FormField>
  );
}
