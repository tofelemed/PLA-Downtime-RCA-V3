import { AreaTabs, type AreaTab } from '@/features/ux-kit/page-layout';
import { DEMAND_PATH, FX_PATH } from '../model/finance-save-results';

/** The lists of Setup › Valuation (`/finance?tab=`). */
export type FinanceAreaTab = 'policies' | 'fx' | 'demand';

const TABS: readonly AreaTab[] = [
  { key: 'policies', label: 'Valuation policy', to: '/finance', testId: 'tab-policies' },
  { key: 'fx', label: 'Exchange rates', to: FX_PATH, testId: 'tab-fx-rates' },
  { key: 'demand', label: 'Demand', to: DEMAND_PATH, testId: 'tab-demand' },
];

/**
 * The one tab row of Valuation: Valuation policy · Exchange rates · Demand, on the list page and on the policy /
 * exchange-rate pages (DECISIONS 2026-10-22).
 */
export function FinanceAreaTabs({ current }: { current: FinanceAreaTab }) {
  return <AreaTabs tabs={TABS} current={current} />;
}
