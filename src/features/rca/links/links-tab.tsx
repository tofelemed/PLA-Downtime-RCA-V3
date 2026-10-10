import { useState } from 'react';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { PlantTime } from '@/features/ux-kit/plant-time';
import { EvidenceView } from '../components/evidence-view';
import { LINK_TYPE_LABELS } from '../model/rca-labels';
import { AddLinkForm } from './add-link-form';

/** RCA02 references of the case with the evidence package each link stored when it was made. */
export function LinksTab({ rcaId, timezone }: { rcaId: string; timezone: string }) {
  const links = useRcaLinks(rcaId);
  const items = links.data ?? [];
  return (
    <div className="space-y-3" data-testid="links-tab">
      <DataState state={dataStateOf(links, { isEmpty: items.length === 0 })} error={links.error} detail="No links yet: link events from the Event Hub or add a reference below.">
        <ul className="divide-y rounded border">
          {items.map((link) => (
            <LinkRow key={link.id} link={link} timezone={timezone} />
          ))}
        </ul>
      </DataState>
      <AddLinkForm rcaId={rcaId} />
      <p className="text-xs text-muted-foreground">Push to CMMS is not available in R1 (D12): work orders are referenced, not created.</p>
    </div>
  );
}

function LinkRow({ link, timezone }: { link: RcaLinkView; timezone: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="space-y-2 p-2 text-sm" data-testid="link-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <span className="font-medium">{LINK_TYPE_LABELS[link.linkType]}</span> {link.targetId}
          <span className="text-muted-foreground">
            {' '}· linked <PlantTime iso={link.linkedAt} tz={timezone} withDate /> · {link.source === 'user' ? 'by a person' : link.source}
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
