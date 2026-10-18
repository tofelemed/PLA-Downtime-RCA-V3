import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ApprovalAction, ApprovalItem } from '@/api/v2/types/approvals';
import { needsReason } from './approval-command';
interface Props { item: ApprovalItem; action: ApprovalAction; reason: string; supersede: boolean; setReason: (value: string) => void; setSupersede: (value: boolean) => void }
export function ApprovalDecisionFields({ item, action, reason, supersede, setReason, setSupersede }: Props) {
  const prefix = `${item.kind}-${item.id}-${action}`;
  const reasonRequired = needsReason(action) || item.resource === 'rules';
  return <>
      {item.supersede && action === 'approve' && <div className="flex items-center gap-2"><Checkbox id={`${prefix}-supersede`} checked={supersede} onCheckedChange={(value) => setSupersede(value === true)} /><Label htmlFor={`${prefix}-supersede`}>Supersede the approved predecessor at this version’s effective start</Label></div>}
      {['production-plans', 'rules', 'actuals/adjustments', 'lot-dispositions', 'uncertainty-budgets', 'source-authority/versions'].includes(item.resource ?? '') && <div className="space-y-2"><Label htmlFor={`${prefix}-reason`}>Reason {reasonRequired ? '(required)' : '(optional)'}</Label><Textarea id={`${prefix}-reason`} maxLength={item.resource === 'rules' ? 500 : 2000} value={reason} onChange={(event) => setReason(event.target.value)} /></div>}
  </>;
}
