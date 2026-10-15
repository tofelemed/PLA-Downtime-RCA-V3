import { LossBasis } from '../domain/accounting/accounting.types';
import {
  DraftAction,
  ManualKind,
} from '../domain/reconciliation/reconciliation.types';
import type { EvidenceType } from './line-evidence-rules';

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
  /** SME R7 / R8: category of an Unaccounted or bridge line */
  classification?: string;
  /** SME R11: the record a quantity rests on when no event or approved adjustment backs it */
  evidenceType?: EvidenceType;
  evidenceRef?: string;
  /** SME R9: the approved line (of an earlier period of the unit) a `reversal` line reverses */
  reversesLineId?: string;
}

export interface DraftLinesCommand {
  revision: number;
  baseRunId: string;
  lines: DraftLineInput[];
}
