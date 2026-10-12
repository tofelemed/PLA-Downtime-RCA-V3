import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import {
  DEFAULT_CALENDAR_PREFERENCE,
  isCalendarSystem,
  isDigitSystem,
  type CalendarPreference,
} from '@/lib/dates';
import { masterDataApi, type Tenant } from '@/services/api/masterDataApi';

/** The acting plant's tenant record: shared key, fresh for 5 minutes, refreshed after a settings save. */
export const tenantKey = (tenantId: string) => ['v1', tenantId, 'tenant'] as const;

/**
 * The acting plant (`plantSelection?.tenant?.id || session?.tenant?.id`) as the server has it now —
 * the stored plant selection carries a snapshot that can be stale, so the settings are read fresh.
 */
export function useActingTenant() {
  const { session } = useAuth();
  const tenantId = useV2TenantId();
  return useQuery<Tenant>({
    queryKey: tenantKey(tenantId ?? '-'),
    enabled: Boolean(session && tenantId),
    staleTime: 5 * 60_000,
    queryFn: () => masterDataApi.getTenant(tenantId as string),
    placeholderData: session?.tenant?.id === tenantId && session?.tenant ? session.tenant : undefined,
  });
}

/** Calendar preference of a tenant record (unknown values fall back to Gregorian / Latin digits). */
export function calendarPreferenceOf(tenant: Pick<Tenant, 'calendarSystem' | 'digits'> | null | undefined): CalendarPreference {
  return {
    calendar: isCalendarSystem(tenant?.calendarSystem) ? tenant.calendarSystem : DEFAULT_CALENDAR_PREFERENCE.calendar,
    digits: isDigitSystem(tenant?.digits) ? tenant.digits : DEFAULT_CALENDAR_PREFERENCE.digits,
  };
}

/** Saves the plant's calendar system and digits (`PUT /tenants/:id/display-settings`). */
export function useSaveDisplaySettings() {
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  return useMutation({
    mutationFn: (preference: CalendarPreference) =>
      masterDataApi.updateTenantDisplaySettings(tenantId as string, {
        calendarSystem: preference.calendar,
        digits: preference.digits,
      }),
    onSuccess: (tenant) => {
      if (tenantId) queryClient.setQueryData(tenantKey(tenantId), tenant);
    },
  });
}
