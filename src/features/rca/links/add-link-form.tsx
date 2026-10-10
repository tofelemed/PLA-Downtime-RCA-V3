import { useState } from 'react';
import { useLinkTargetToRca } from '@/api/v2/queries/rca-commands';
import { RCA_LINK_TYPES, type RcaLinkType } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommandError } from '@/features/event-hub/components/command-error';
import { LINK_TYPE_LABELS } from '../model/rca-labels';

/** Adds a reference by id: an event, an approved loss line, a work order number or an occurrence. */
export function AddLinkForm({ rcaId }: { rcaId: string }) {
  const link = useLinkTargetToRca();
  const [linkType, setLinkType] = useState<RcaLinkType>('work_order');
  const [targetId, setTargetId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const submit = async () => {
    const result = await link.submit({ rcaId, body: { linkType, targetId: targetId.trim() } }).catch(() => null);
    if (!result) return;
    setMessage(result.created ? 'Linked.' : 'Already linked.');
    setTargetId('');
  };
  return (
    <div className="space-y-2 rounded border p-2" data-testid="add-link">
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded border px-2 text-sm"
          aria-label="Link type"
          value={linkType}
          onChange={(e) => setLinkType(RCA_LINK_TYPES.find((type) => type === e.target.value) ?? 'work_order')}
        >
          {RCA_LINK_TYPES.map((type) => (
            <option key={type} value={type}>{LINK_TYPE_LABELS[type]}</option>
          ))}
        </select>
        <Input className="max-w-sm" aria-label="Target id" placeholder="Id or work order number" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <Button size="sm" disabled={targetId.trim() === '' || link.isPending} onClick={() => void submit()}>Link</Button>
      </div>
      {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
      <CommandError error={link.error} />
    </div>
  );
}
