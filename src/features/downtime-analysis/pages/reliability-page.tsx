import { ReliabilityCard } from '../components/reliability-card';
import type { DowntimePageProps } from './page-types';

export function DowntimeReliabilityPage({ filters }: DowntimePageProps) {
  return <div data-testid="downtime-view-reliability"><ReliabilityCard filters={filters} /></div>;
}
