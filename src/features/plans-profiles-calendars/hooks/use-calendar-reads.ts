import { useQuery } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { STALE_TIME } from '@/api/v2/queries/stale-times';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { CalendarVersionView } from '@/api/v2/types/calendars';

/** One calendar version (editor page). */
export function useCalendarVersion(versionId: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'calendars', versionId ?? '-', 'version'),
    enabled: Boolean(tenantId && versionId),
    staleTime: STALE_TIME.calendars,
    queryFn: async ({ signal }) => (await v2Request<CalendarVersionView>({ method: 'GET', path: `/calendar-versions/${versionId}`, signal })).data,
  });
}
