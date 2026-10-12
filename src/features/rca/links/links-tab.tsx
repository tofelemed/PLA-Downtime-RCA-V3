import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { humanize, labelOf } from '@/features/ux-kit/labels';
import { RCA_LINK_SOURCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { EvidenceView } from '../components/evidence-view';
import { LINK_TYPE_LABELS } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { AddLinkForm } from './add-link-form';

interface EventSnapshot {
  start?: unknown;
  physicalType?: unknown;
}

/** What the link points at, in words: the event's kind and start, or the work order number. */
function TargetText({ link }: { link: RcaLinkView }) {
  const { dateTime } = useRcaFormat();
  if (link.linkType === 'event') {
    const event = (link.evidence?.event ?? {}) as EventSnapshot;
    const start = typeof event.start === 'string' ? dateTime(event.start) : null;
    const kind = typeof event.physicalType === 'string' ? humanize(event.physicalType) : 'Event';
    return (
      <Link className="underline" to={`/events/${encodeURIComponent(link.targetId)}`}>
        {kind}
        {start ? ` from ${start}` : ''}
      </Link>
    );
  }
  if (link.linkType === 'work_order') return <>{link.targetId}</>;
  return null;
}

function LinkRow({ link, timezone }: { link: RcaLinkView; timezone: string }) {
  const [open, setOpen] = useState(false);
  const { dateTime } = useRcaFormat();
  return (
    <li className="space-y-2 p-2 text-sm" data-testid="link-row" data-target-id={link.targetId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{LINK_TYPE_LABELS[link.linkType]}</span> <TargetText link={link} />
          <span className="text-muted-foreground">
            {' '}
            · linked {dateTime(link.linkedAt)} · {labelOf(RCA_LINK_SOURCE_LABELS, link.source)}
          </span>
        </span>
        <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? 'Hide evidence' : 'Evidence'}
        </Button>
      </div>
      {link.reason && <p className="text-muted-foreground">{link.reason}</p>}
      {open && <EvidenceView evidence={link.evidence} timezone={timezone} />}
    </li>
  );
}

/** RCA02 references of the case with the evidence package each link stored when it was made. */
export function LinksTab({ rcaId, timezone }: { rcaId: string; timezone: string }) {
  const { canWriteRca } = useCapabilities();
  const links = useRcaLinks(rcaId);
  const items = links.data ?? [];
  return (
    <div className="space-y-3" data-testid="links-tab">
      <DataState
        state={dataStateOf(links, { isEmpty: items.length === 0 })}
        error={links.error}
        detail="No links yet: link events from the Event Hub or add a reference below."
      >
        <ul className="divide-y rounded border">
          {items.map((link) => (
            <LinkRow key={link.id} link={link} timezone={timezone} />
          ))}
        </ul>
      </DataState>
      {canWriteRca && <AddLinkForm rcaId={rcaId} />}
      <p className="text-xs text-muted-foreground">Work orders are referenced by their number; pushing work to the maintenance system is not available yet.</p>
    </div>
  );
}
