import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ApprovalItem } from '@/api/v2/types/approvals';
import { ApprovalRecordDetails } from './approval-record-details';
import { useApprovalRecord } from './use-approval-record';
export function ApprovalRecordReview({ item }: { item: ApprovalItem }) {
  const [open, setOpen] = useState(false);
  const record = useApprovalRecord(item, open);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Review details</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{item.title}</DialogTitle><DialogDescription>{item.kindLabel} · {item.unitName ?? 'Plant-wide'} · {item.state}</DialogDescription></DialogHeader><ApprovalRecordDetails record={record} /></DialogContent></Dialog>;
}
