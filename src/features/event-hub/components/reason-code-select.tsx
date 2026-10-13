import { ReasonCodePicker } from '@/features/ux-kit/reason-code-picker/reason-code-picker';
import { useEventHubEnv } from '../use-event-hub-env';

export interface ReasonCodeSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** allow "no reason" (clears the code on edit) */
  allowEmpty?: boolean;
}

/** Event Hub reason picker: the shared searchable, leaf-only picker over the plant's reason codes (FE-04). */
export function ReasonCodeSelect({ id, value, onChange, error, allowEmpty = true }: ReasonCodeSelectProps) {
  const { allReasonCodes } = useEventHubEnv();
  return <ReasonCodePicker id={id} codes={allReasonCodes} value={value} onChange={onChange} error={error} emptyLabel={allowEmpty ? '— none —' : null} />;
}
