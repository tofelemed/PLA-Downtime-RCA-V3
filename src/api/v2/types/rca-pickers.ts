/**
 * v2 views of the RCA queues and link pickers (UX remediation U3; backend `rca-action-queue.service.ts`,
 * `rca-case/occurrence-picker.ts`, `v2/accounting/loss-line-picker.ts`). Decimals are strings.
 */
import type { RcaActionView } from './rca';

/** A row of `GET /v2/rca-actions`: the action with its investigation. */
export interface RcaActionListItemView extends RcaActionView {
  case: { id: string; title: string; status: string | null; unitId: string | null };
}

/** A row of `GET /v2/occurrences`: one stop occurrence with its first event and the cases it is linked to. */
export interface RcaOccurrenceView {
  occurrenceId: string;
  unitId: string;
  startTime: string;
  endTime: string | null;
  eventCount: number;
  firstEventId: string;
  description: string | null;
  assetId: string | null;
  assetName: string | null;
  reasonCodeId: string | null;
  reasonName: string | null;
  linkedRcaIds: string[];
}

/** A row of `GET /v2/loss-lines`; `id` is the `targetId` of a `loss_line` link. */
export interface LossLinePickerView {
  id: string;
  periodId: string;
  unitId: string;
  localDate: string;
  shiftName: string | null;
  periodStart: string;
  revisionId: string;
  revision: number;
  lifecycle: string;
  runId: string;
  kind: string;
  /** decimal string */
  quantity: string;
  uom: string | null;
  basis: string;
  segmentStart: string;
  segmentEnd: string;
  reasonCodeId: string | null;
  reasonCode: string | null;
  reasonName: string | null;
  causeEventId: string | null;
  causeEventDescription: string | null;
  occurrenceId: string | null;
}
