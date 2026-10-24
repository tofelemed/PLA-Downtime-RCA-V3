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

/** Page header of the dashboard: the title, the time period, the one status and, for an organisation, which plant is shown. */
export function DashboardHeader({ scope, keyValue, onKey, orgOnly, plantName }: DashboardHeaderProps) {
  const meta = (
    <div className="space-y-1">
      {orgOnly && (
        <p data-testid="dashboard-org-note">
          Showing {plantName} — organisation-wide figures are not available yet
        </p>
      )}
      <DashboardStatus scope={scope} />
    </div>
  );
  return <PageHeader title="Dashboard" actions={<TimePeriodControl value={keyValue} onChange={onKey} />} meta={meta} />;
}
