import { useState } from 'react';
import { RCA_LINK_TYPES, type RcaLinkType } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LINK_TYPE_LABELS } from '../model/rca-labels';

export interface RawReferenceFormProps {
  busy: boolean;
  /** resolves true when the link was made (the field is then cleared) */
  onLink: (linkType: RcaLinkType, targetId: string) => Promise<boolean>;
}

/** "Advanced": link by a reference copied from another record (any link type), for when a picker cannot find it. */
export function RawReferenceForm({ busy, onLink }: RawReferenceFormProps) {
  const [linkType, setLinkType] = useState<RcaLinkType>('event');
  const [targetId, setTargetId] = useState('');
  const submit = async () => {
    if (await onLink(linkType, targetId.trim())) setTargetId('');
  };
  return (
    <details className="rounded-md border px-3 py-2" data-testid="raw-reference">
      <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Advanced: link by reference</summary>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Reference type"
          value={linkType}
          onChange={(e) => setLinkType(RCA_LINK_TYPES.find((type) => type === e.target.value) ?? 'event')}
        >
          {RCA_LINK_TYPES.map((type) => (
            <option key={type} value={type}>
              {LINK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <Input className="h-9 max-w-sm" aria-label="Reference" placeholder="Reference copied from the record" value={targetId} onChange={(e) => setTargetId(e.target.value)} />
        <Button type="button" className="h-9" disabled={targetId.trim() === '' || busy} onClick={() => void submit()} data-testid="link-reference">
          Link reference
        </Button>
      </div>
    </details>
  );
}
