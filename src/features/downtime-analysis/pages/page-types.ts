import type { ProductionEventView } from '@/api/v2/types/events';
import type { DowntimeBundleResult } from '../hooks/use-downtime-bundle';
import type { DowntimeFilters } from '../model/downtime-filters';

export interface DowntimePageProps {
  filters: DowntimeFilters;
  bundle: DowntimeBundleResult;
  onChange: (patch: Partial<DowntimeFilters>) => void;
  onClose: (event: ProductionEventView) => void;
  onCode: (event: ProductionEventView) => void;
}
