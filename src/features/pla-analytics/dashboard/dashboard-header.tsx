import { PageHeader } from '@/features/ux-kit/page-layout';
import type { AnalyticsScope } from '../model/analytics-scope';
import type { DashboardPresetKey } from '../model/dashboard-scope';
import { DashboardStatus } from './dashboard-status';
import { TimePeriodControl } from './time-period-control';

export interface DashboardHeaderProps {
  scope: AnalyticsScope;
  keyValue: DashboardPresetKey;
  onKey: (key: DashboardPresetKey) => void;
  /** an organisation is chosen without a plant */
  orgOnly: boolean;
  plantName: string;
}

/** Page header of the dashboard: the title, the time period, and the one status (or why there is none). */
export function DashboardHeader({ scope, keyValue, onKey, orgOnly, plantName }: DashboardHeaderProps) {
  const status = orgOnly ? `Showing ${plantName} — organisation-wide figures are not available yet` : <DashboardStatus scope={scope} />;
  return <PageHeader title="Dashboard" actions={<TimePeriodControl value={keyValue} onChange={onKey} />} meta={status} />;
}
