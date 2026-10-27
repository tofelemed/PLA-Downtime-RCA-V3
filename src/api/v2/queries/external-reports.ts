import type { ExternalReportV2View } from '../types/external-reports';
import { usePagedQuery } from './use-paged-query';

/**
 * Daily production reports an MQTT connection received (plans/MQTT_FEEDS.md): keyset pages of 20,
 * newest production date first. Cached with the connection's data (refreshed by its changes).
 */
export function useConnectionExternalReports(connectionId: string, enabled = true) {
  return usePagedQuery<ExternalReportV2View>({
    resource: 'connections',
    path: '/external-production-reports',
    query: { connectionId },
    key: { filters: { view: 'external-reports', connectionId } },
    enabled,
  });
}
