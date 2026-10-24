import { useMemo, useState } from 'react';
import { useRcaLinks } from '@/api/v2/queries/rca-cases';
import { useLinkTargetToRca } from '@/api/v2/queries/rca-commands';
import type { RcaLinkType } from '@/api/v2/types/rca';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SELECT_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { FriendlyErrorAlert } from '@/features/ux-kit/errors';
import { hasWindow, linkedLossLineKeys } from '../model/link-picker';
import { LINK_TYPE_LABELS } from '../model/rca-labels';
import { useRcaFormat } from '../use-rca-format';
import { EventLinkPicker } from './event-link-picker';
import { LinkPickerFiltersBar } from './link-picker-filters-bar';
import { LossLinePicker } from './loss-line-picker';
import { OccurrencePicker } from './occurrence-picker';
import { RawReferenceForm } from './raw-reference-form';
import { useLinkPickerFilters } from './use-link-picker-filters';

const PICKER_TYPES = ['event', 'loss_line', 'occurrence', 'work_order'] as const;
type PickerType = (typeof PICKER_TYPES)[number];

const SEARCH_LABELS: Readonly<Record<Exclude<PickerType, 'work_order'>, string>> = {
  event: 'Search event descriptions',
  loss_line: 'Search reason or cause event',
  occurrence: 'Search event descriptions',
};

function WorkOrderField({ busy, onLink }: { busy: boolean; onLink: (targetId: string) => Promise<boolean> }) {
  const [number, setNumber] = useState('');
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="link-work-order">Work order number</Label>
        <Input id="link-work-order" className="h-9 w-64" value={number} onChange={(e) => setNumber(e.target.value)} />
      </div>
      <Button type="button" className="h-9" disabled={number.trim() === '' || busy} onClick={() => void onLink(number.trim()).then((ok) => ok && setNumber(''))}>
        Link
      </Button>
    </div>
  );
}

/**
 * Adds a link: events, approved loss lines and stop occurrences are picked from server searches (unit,
 * reason, window, text; default window 30 days around the trigger event); work orders by number. A raw
 * reference stays available under "Advanced".
 */
export function AddLinkForm({ rcaId }: { rcaId: string }) {
  const link = useLinkTargetToRca();
  const links = useRcaLinks(rcaId);
  const { timezone } = useRcaFormat();
  const filters = useLinkPickerFilters(links.data, timezone);
  const [linkType, setLinkType] = useState<PickerType>('event');
  const [message, setMessage] = useState<string | null>(null);
  const linkedIds = useMemo(() => new Set((links.data ?? []).map((item) => item.targetId)), [links.data]);
  const linkedKeys = useMemo(() => linkedLossLineKeys(links.data ?? []), [links.data]);
  const submit = async (type: RcaLinkType, targetId: string): Promise<boolean> => {
    setMessage(null);
    const result = await link.submit({ rcaId, body: { linkType: type, targetId } }).catch(() => null);
    if (!result) return false;
    setMessage(result.created ? 'Linked.' : 'Already linked.');
    return true;
  };
  const pick = (targetId: string) => void submit(linkType, targetId);
  const picker = { onLink: pick, busy: link.isPending, linkedIds, filters: filters.value };
  return (
    <div className="space-y-3 border-t pt-4" data-testid="add-link">
      <h3 className="text-sm font-semibold">Add a link</h3>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="link-type">Link</Label>
        <select
          id="link-type"
          className={`${SELECT_CLASS} w-56`}
          value={linkType}
          onChange={(e) => setLinkType(PICKER_TYPES.find((type) => type === e.target.value) ?? 'event')}
        >
          {PICKER_TYPES.map((type) => (
            <option key={type} value={type}>
              {LINK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </div>
      {linkType === 'work_order' ? (
        <WorkOrderField busy={link.isPending} onLink={(targetId) => submit('work_order', targetId)} />
      ) : (
        <>
          <LinkPickerFiltersBar
            idPrefix={`link-${linkType}`}
            value={filters.value}
            onChange={filters.onChange}
            searchLabel={SEARCH_LABELS[linkType]}
            windowError={hasWindow(filters.value) || linkType !== 'occurrence' ? null : 'Choose a From day on or before the To day.'}
          />
          {linkType === 'event' && <EventLinkPicker {...picker} />}
          {linkType === 'loss_line' && <LossLinePicker {...picker} linkedKeys={linkedKeys} />}
          {linkType === 'occurrence' && <OccurrencePicker {...picker} />}
        </>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {link.error ? <FriendlyErrorAlert error={link.error} /> : null}
      <RawReferenceForm busy={link.isPending} onLink={submit} />
    </div>
  );
}
