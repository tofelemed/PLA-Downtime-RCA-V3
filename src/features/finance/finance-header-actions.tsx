import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { ActionIcon } from '@/lib/icons';
import type { FinanceAreaTab } from './components/finance-area-tabs';
import { AddDemandStatus } from './demand/add-demand-status';
import { AddFxRate } from './fx/add-fx-rate';

function NewPolicyVersion() {
  return (
    <Button asChild size="sm" className="whitespace-nowrap" data-testid="policy-new">
      <Link to="/finance/policies/new">
        <ActionIcon.add aria-hidden="true" />
        New policy version
      </Link>
    </Button>
  );
}

const ADD: Record<FinanceAreaTab, ComponentType> = { policies: NewPolicyVersion, fx: AddFxRate, demand: AddDemandStatus };

/**
 * The add action of the active Valuation tab, right-aligned in the page header (SETUP_UX_FIXES Phase 4):
 * New policy version · Add exchange rate draft · Add demand status draft for finance maintainers, the
 * Read-only hint for everyone else.
 */
export function FinanceHeaderActions({ tab }: { tab: FinanceAreaTab }) {
  const { canMaintainValuation } = useCapabilities();
  const Add = ADD[tab];
  return (
    <>
      <ReadOnlyHint />
      {canMaintainValuation && <Add />}
    </>
  );
}
