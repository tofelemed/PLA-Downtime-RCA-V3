import type { ApprovalItem } from '@/api/v2/types/approvals';
import type { OnDecided } from './use-decided-when';

/** Every inline decision form: the pending record and what to do once the server confirmed the decision. */
export interface InlineFormProps {
  item: ApprovalItem;
  onDecided: OnDecided;
}
