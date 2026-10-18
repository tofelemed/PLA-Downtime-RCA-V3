import { Link } from 'react-router-dom';
import type { ApprovedValuationView } from '@/api/v2/types/reconciliation';
import { Button } from '@/components/ui/button';
import { DEFAULT_BASIS_LABELS, labelOf } from '@/features/ux-kit/labels';
import { policyVersionText, type ValuationShown } from '../model/valuation-basis';

interface Props {
  approved: ApprovedValuationView;
  shown: ValuationShown;
  onShow: (shown: ValuationShown) => void;
  /** the period's History & exports section, where its change proposals are listed */
  historyHref: string;
}

function RestatementNote({ approved, historyHref }: Pick<Props, 'approved' | 'historyHref'>) {
  return (
    <p data-testid="valuation-restatement-note">
      Current policy view: {labelOf(DEFAULT_BASIS_LABELS, approved.current.view)}.{' '}
      {approved.restatementProposalId ? (
        <>
          Restatement pending under {policyVersionText(approved.current.policyVersion)}:{' '}
          <Link className="font-medium underline" to={historyHref} data-testid="valuation-restatement-link" data-proposal-id={approved.restatementProposalId}>
            open change proposal
          </Link>
          .
        </>
      ) : (
        <>No restatement opened.</>
      )}
    </p>
  );
}

/**
 * Owner, 18 Oct 2026: the valuation view an approved revision shows is the one frozen at approval. When
 * the current policy opens on another view, the pending restatement is noted and the current view is a
 * secondary toggle marked "not approved" — never a silent substitute.
 */
export function ValuationBasisNote({ approved, shown, onShow, historyHref }: Props) {
  const frozen = labelOf(DEFAULT_BASIS_LABELS, approved.view);
  return (
    <div role="status" className="space-y-2 rounded-md border p-3 text-sm" data-testid="valuation-basis-note" data-shown={shown}>
      <p>
        Approved valuation view: <span className="font-medium">{frozen}</span>, frozen at approval under {policyVersionText(approved.policyVersion)}.
      </p>
      {approved.differs && (
        <>
          <RestatementNote approved={approved} historyHref={historyHref} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Valuation view">
            <Button size="sm" variant={shown === 'approved' ? 'default' : 'outline'} aria-pressed={shown === 'approved'} onClick={() => onShow('approved')}>
              Approved view
            </Button>
            <Button size="sm" variant={shown === 'current' ? 'default' : 'outline'} aria-pressed={shown === 'current'} onClick={() => onShow('current')}>
              Current policy view (not approved)
            </Button>
          </div>
          {shown === 'current' && <p className="text-warning" data-testid="valuation-current-warning">Shown under the current policy view: these figures are not the approved ones.</p>}
        </>
      )}
    </div>
  );
}
