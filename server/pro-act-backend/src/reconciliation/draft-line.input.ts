import { LossBasis } from '../domain/accounting/accounting.types';
import {
  DraftAction,
  ManualKind,
} from '../domain/reconciliation/reconciliation.types';

/** One line of a draft save as the editor sends it (§15.3). */
export interface DraftLineInput {
  action: DraftAction;
  /** the candidate a decision refers to (accept / adjust / replace / reject) */
  autoKey?: string;
  /** required for manual lines; must match the candidate's slice for decisions */
  sliceId?: string;
  kind?: ManualKind;
  /** decimal string, ≤ 8 decimals; negative only for bridge / gain */
  quantity?: string;
  basis?: LossBasis;
  reasonCodeId?: string;
  impactCodeId?: string;
  eventIds?: string[];
  adjustmentId?: string;
  missingCode?: boolean;
  missingEvent?: boolean;
  reason?: string;
  comment?: string;
}

export interface DraftLinesCommand {
  revision: number;
  baseRunId: string;
  lines: DraftLineInput[];
}
