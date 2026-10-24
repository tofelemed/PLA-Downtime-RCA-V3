import { useCapabilities } from '@/features/auth/use-capabilities';
import { RCA_LIST_LINKS } from './dashboard-links';
import type { KpiSectionLink } from './kpi-section';

/** Header links of Asset reliability: the cause portfolio (analysts) and the investigations list (operators). */
export function useReliabilityLinks(): KpiSectionLink[] {
  const { canViewOperations, canViewAnalysis } = useCapabilities();
  const links: KpiSectionLink[] = [];
  if (canViewAnalysis) links.push({ to: '/reliability/portfolio', label: 'Cause portfolio', testId: 'dashboard-rca-portfolio' });
  if (canViewOperations) links.push({ to: RCA_LIST_LINKS.all, label: 'Investigations', testId: 'dashboard-rca-investigations' });
  return links;
}
