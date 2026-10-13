import { useAllCodes } from '@/api/v2/queries/reference-data';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { ReasonCodePicker } from '@/features/ux-kit/reason-code-picker/reason-code-picker';

export interface ReasonSelectProps {
  id: string;
  value: string;
  disabled?: boolean;
  onChange: (reasonCodeId: string) => void;
}

/** Reconciliation reason picker: the shared searchable, leaf-only picker (FE-04). */
export function ReasonSelect({ id, value, disabled, onChange }: ReasonSelectProps) {
  const codes = useAllCodes('reason-codes');
  return <ReasonCodePicker id={id} codes={flattenPages(codes.data?.pages)} value={value} disabled={disabled} onChange={onChange} emptyLabel="— choose —" />;
}
