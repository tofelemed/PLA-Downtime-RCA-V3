import { PageHeader } from '@/features/ux-kit/page-layout';
import type { DashboardPresetKey } from '../model/dashboard-scope';
import { TimePeriodControl } from './time-period-control';

export interface DashboardHeaderProps {
  keyValue: DashboardPresetKey;
  onKey: (key: DashboardPresetKey) => void;
  /** an organisation is chosen without a plant */
  orgOnly: boolean;
  plantName: string;
}

/** Page header of the dashboard: the title, the time period and, for an organisation, which plant is shown. */
export function DashboardHeader({ keyValue, onKey, orgOnly, plantName }: DashboardHeaderProps) {
  const meta = orgOnly ? (
    <p data-testid="dashboard-org-note">Showing {plantName} — organisation-wide figures are not available yet</p>
  ) : undefined;
  return <PageHeader title="Dashboard" actions={<TimePeriodControl value={keyValue} onChange={onKey} />} meta={meta} />;
}
