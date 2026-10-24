import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import type { RcaLinkView } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { labelOf } from '@/features/ux-kit/labels';
import { RCA_LINK_SOURCE_LABELS } from '@/features/ux-kit/labels/rca-labels';
import { CASE_CELL, CaseRecordTable, type CaseRecordColumn } from '../case/components/case-record-table';
import { EvidenceView } from '../components/evidence-view';
import { LINK_TYPE_LABELS, linkedEventKind } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { AddLinkForm } from './add-link-form';

interface EventSnapshot {
  start?: unknown;
  physicalType?: unknown;
}

const COLUMNS: readonly CaseRecordColumn[] = [
  { id: 'link', header: 'Link' },
  { id: 'linked', header: 'Linked', width: '10rem' },
  { id: 'source', header: 'Source', width: '8rem' },
  { id: 'reason', header: 'Reason' },
  { id: 'evidence', header: 'Evidence', width: '8rem', align: 'right' },
];

/** What the link points at, in words: the event's kind and start, or the work order number. */
function TargetText({ link }: { link: RcaLinkView }) {
  const { dateTime } = useRcaFormat();
  if (link.linkType === 'event') {
    const event = (link.evidence?.event ?? {}) as EventSnapshot;
    const start = typeof event.start === 'string' ? dateTime(event.start) : null;
    const kind = linkedEventKind(event.physicalType);
    return (
      <Link className="font-medium underline" to={`/events/${encodeURIComponent(link.targetId)}`}>
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
    <>
      <TableRow data-testid="link-row" data-target-id={link.targetId}>
        <TableCell className={CASE_CELL}>
          {link.linkType !== 'event' && <span className="font-medium">{LINK_TYPE_LABELS[link.linkType]} </span>}
          <TargetText link={link} />
        </TableCell>
        <TableCell className={`${CASE_CELL} whitespace-nowrap`}>{dateTime(link.linkedAt)}</TableCell>
        <TableCell className={`${CASE_CELL} whitespace-nowrap`}>{labelOf(RCA_LINK_SOURCE_LABELS, link.source)}</TableCell>
        <TableCell className={`${CASE_CELL} text-muted-foreground`}>{link.reason || '—'}</TableCell>
        <TableCell className={`${CASE_CELL} text-right`}>
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide evidence' : 'Evidence'}
          </Button>
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMNS.length} className={`${CASE_CELL} bg-muted/30`}>
            <EvidenceView evidence={link.evidence} timezone={timezone} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * RCA02 references of the case with the evidence package each link stored when it was made. A closed case
 * takes no new link (server 409 CASE_CLOSED, Marun G4), so the add-link form is replaced by a note.
 */
export function LinksTab({ rcaId, timezone, closed = false }: { rcaId: string; timezone: string; closed?: boolean }) {
  const { canWriteRca } = useCapabilities();
  const links = useRcaLinks(rcaId);
  const items = links.data ?? [];
  return (
    <div className="space-y-4" data-testid="links-tab">
      <DataState state={dataStateOf(links, { isEmpty: items.length === 0 })} error={links.error} detail="No links yet: link events from the Event Hub or add a reference below.">
        <CaseRecordTable caption="Links of this investigation" columns={COLUMNS}>
          {items.map((link) => (
            <LinkRow key={link.id} link={link} timezone={timezone} />
          ))}
        </CaseRecordTable>
      </DataState>
      {canWriteRca && !closed && <AddLinkForm rcaId={rcaId} />}
      {canWriteRca && closed && (
        <p className="text-xs text-muted-foreground" data-testid="links-closed">
          This investigation is closed: reopen it to add a link.
        </p>
      )}
    </div>
  );
}
