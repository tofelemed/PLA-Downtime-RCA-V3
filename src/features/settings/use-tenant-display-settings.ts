import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { adminCall } from '@/api/v2/queries/administration-shared';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { PlantView } from '@/api/v2/types/administration';
import {
  DEFAULT_CALENDAR_PREFERENCE,
  isCalendarSystem,
  isDigitSystem,
  type CalendarPreference,
} from '@/lib/dates';

/** The acting plant's record (`GET /v2/tenants/:id`): shared key, fresh for 5 minutes, set after a save. */
export const tenantKey = (tenantId: string) => v2Keys.detail(tenantId, 'admin-config', tenantId, 'plant');

type PlantDisplay = Pick<PlantView, 'name' | 'calendarSystem' | 'digits'> & Partial<Pick<PlantView, 'code' | 'organizationName'>>;

/**
 * The acting plant (`plantSelection?.tenant?.id || session?.tenant?.id`) as the server has it now —
 * the stored plant selection carries a snapshot that can be stale, so the settings are read fresh. Until
 * then the session's plant snapshot keeps the calendar from flashing to Gregorian.
 */
export function useActingTenant() {
  const { session } = useAuth();
  const tenantId = useV2TenantId();
  const snapshot = session?.tenant?.id === tenantId ? session?.tenant : undefined;
  return useQuery<PlantDisplay>({
    queryKey: tenantKey(tenantId ?? '-'),
    enabled: Boolean(session && tenantId),
    staleTime: 5 * 60_000,
    queryFn: ({ signal }) => adminCall<PlantView>('GET', `/tenants/${tenantId}`, { signal }),
    placeholderData: snapshot
      ? { name: snapshot.name, calendarSystem: snapshot.calendarSystem ?? 'gregorian', digits: snapshot.digits ?? 'latin' }
      : undefined,
  });
}

/** Calendar preference of a plant record (unknown values fall back to Gregorian / Latin digits). */
export function calendarPreferenceOf(tenant: Partial<Pick<PlantView, 'calendarSystem' | 'digits'>> | null | undefined): CalendarPreference {
  return {
    calendar: isCalendarSystem(tenant?.calendarSystem) ? tenant.calendarSystem : DEFAULT_CALENDAR_PREFERENCE.calendar,
    digits: isDigitSystem(tenant?.digits) ? tenant.digits : DEFAULT_CALENDAR_PREFERENCE.digits,
  };
}

/** Saves the plant's calendar system and digits (`PATCH /v2/tenants/:id/display-settings`). */
export function useSaveDisplaySettings() {
  const queryClient = useQueryClient();
  const tenantId = useV2TenantId();
  return useMutation({
    mutationFn: (preference: CalendarPreference) =>
      adminCall<PlantView>('PATCH', `/tenants/${tenantId}/display-settings`, {
        body: { calendarSystem: preference.calendar, digits: preference.digits },
      }),
    onSuccess: (plant) => {
      if (tenantId) queryClient.setQueryData(tenantKey(tenantId), plant);
    },
  });
}
