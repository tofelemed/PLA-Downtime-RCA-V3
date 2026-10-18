import { useMemo } from 'react';
import { useLossLinePage } from '@/api/v2/queries/rca-pickers';
import type { LossLinePickerView } from '@/api/v2/types/rca-pickers';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { labelOf } from '@/features/ux-kit/labels';
import { LOSS_KIND_LABELS } from '@/features/ux-kit/labels/workflow-labels';
import { Quantity } from '@/features/ux-kit/quantity';
import { hasWindow, lossLineKey, pickerWindow, type LinkPickerFilters } from '../model/link-picker';
import { useRcaFormat } from '../use-rca-format';
import { useUnitNames } from '../use-unit-names';
import { LinkRowButton, type PickerProps } from './link-row-button';

interface Context extends Pick<PickerProps, 'onLink' | 'busy' | 'linkedIds'> {
  linkedKeys: ReadonlySet<string>;
  day: (value: string | null) => string;
  unitName: (id: string | null) => string;
}

function columnsOf(context: Context): DataTableColumn<LossLinePickerView>[] {
  return [
    { id: 'day', header: 'Day', cell: (line) => `${context.day(line.localDate)}${line.shiftName ? ` · ${line.shiftName}` : ''}`, nowrap: true },
    { id: 'unit', header: 'Unit', cell: (line) => context.unitName(line.unitId) },
    { id: 'kind', header: 'Kind', cell: (line) => labelOf(LOSS_KIND_LABELS, line.kind) },
    { id: 'quantity', header: 'Quantity', cell: (line) => <Quantity value={line.quantity} uom={line.uom} />, align: 'right', nowrap: true },
    { id: 'reason', header: 'Reason', cell: (line) => line.reasonName ?? line.reasonCode ?? <span className="text-muted-foreground">Not coded</span> },
    { id: 'cause', header: 'Cause event', cell: (line) => line.causeEventDescription ?? <span className="text-muted-foreground">—</span> },
    {
      id: 'link',
      header: <span className="sr-only">Link</span>,
      cell: (line) => (
        <LinkRowButton targetId={line.id} label={`Link loss line of ${context.day(line.localDate)}`} linkedElsewhere={context.linkedKeys.has(lossLineKey(line))} {...context} />
      ),
    },
  ];
}

export interface LossLinePickerProps extends PickerProps {
  filters: LinkPickerFilters;
  /** `linkedLossLineKeys` of the case: lines linked under an earlier run's id read "Linked" too */
  linkedKeys?: ReadonlySet<string>;
}

const NO_KEYS: ReadonlySet<string> = new Set();

/** Approved loss lines of the plan ledger (`GET /v2/loss-lines`), newest period first; "Link" links one. */
export function LossLinePicker({ filters, onLink, busy, linkedIds, linkedKeys = NO_KEYS }: LossLinePickerProps) {
  const { day, timezone } = useRcaFormat();
  const { unitName } = useUnitNames();
  const window = hasWindow(filters) ? pickerWindow(filters, timezone) : {};
  const paged = useLossLinePage({
    ...window,
    unitIds: filters.unitId ? [filters.unitId] : undefined,
    reasonCodeIds: filters.reasonCodeId ? [filters.reasonCodeId] : undefined,
    q: filters.q.trim() || undefined,
  });
  const columns = useMemo(() => columnsOf({ day, unitName, onLink, busy, linkedIds, linkedKeys }), [day, unitName, onLink, busy, linkedIds, linkedKeys]);
  return (
    <div data-testid="loss-line-picker">
      <DataTable
        caption="Approved loss lines"
        columns={columns}
        rows={paged.rows}
        getRowKey={(line) => line.id}
        pager={paged.pager}
        status={paged.status}
        empty={{ title: 'No loss lines', text: 'No approved loss line matches these filters.' }}
      />
    </div>
  );
}
