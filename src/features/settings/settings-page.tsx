import { useMemo } from 'react';
import { AdminCard } from '@/features/admin/shared/admin-card';
import { SectionPage } from '@/features/admin/shared/section-page';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CalendarSettingsForm } from './calendar-settings-form';
import { calendarPreferenceOf, useActingTenant, useSaveWeekStart } from './use-tenant-display-settings';
import { WeekStartForm } from './week-start-form';

const ZONE_SOURCE: Record<string, string> = {
  site: 'from the default site',
  tenant: 'from the plant record',
  'utc-fallback': 'no plant timezone is configured; times show in UTC',
};
const DISPLAY_INFO = 'Applies to every screen and PDF export of this plant, for every user. CSV exports keep ISO dates.';
const WEEK_INFO = "Weekly trends and reports group the plant's days from this weekday on. Which days are worked is set by the shift calendar.";
const PLANT_INFO = "The time zone is set on the plant's sites and calendars.";

function PlantFacts({ organization, code, zone }: { organization?: string | null; code?: string | null; zone: ReturnType<typeof usePlantTimezone> }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
      <dt className="text-muted-foreground">Organization</dt>
      <dd>{organization ?? '—'}</dd>
      <dt className="text-muted-foreground">Code</dt>
      <dd>{code ?? '—'}</dd>
      <dt className="text-muted-foreground">Time zone</dt>
      <dd data-testid="plant-timezone">
        <span className="font-medium">{zone.timezone}</span> <span className="text-muted-foreground">({ZONE_SOURCE[zone.source]})</span>
      </dd>
    </dl>
  );
}

/**
 * Plant settings (replaces the old "coming soon" placeholder): how dates and numbers are shown for the
 * selected plant, and its reporting week (DT-10). The timezone is shown read-only (it is set on the plant's sites and calendars).
 */
export function SettingsPage({ embedded = false }: { embedded?: boolean }) {
  const tenant = useActingTenant();
  const zone = usePlantTimezone();
  const { canManagePlantSettings } = useCapabilities();
  const calendar = tenant.data?.calendarSystem;
  const digits = tenant.data?.digits;
  const saved = useMemo(() => calendarPreferenceOf({ calendarSystem: calendar, digits }), [calendar, digits]);
  const state = dataStateOf(tenant);
  const saveWeek = useSaveWeekStart();
  const retry = () => void tenant.refetch();

  return (
    <SectionPage embedded={embedded} title="Plant settings">
      <AdminCard title="Date and number display" info={DISPLAY_INFO} testId="plant-display-settings">
        <DataState state={state} error={tenant.error} onRetry={retry}>
          <CalendarSettingsForm saved={saved} timeZone={zone.timezone} canEdit={canManagePlantSettings} />
        </DataState>
      </AdminCard>
      <AdminCard title="Reporting week" info={WEEK_INFO} testId="plant-week-start">
        <DataState state={state} error={tenant.error} onRetry={retry}>
          <WeekStartForm saved={tenant.data?.weekStart ?? ''} canEdit={canManagePlantSettings} pending={saveWeek.isPending} error={saveWeek.error} onSave={(weekStart) => saveWeek.mutate(weekStart)} />
        </DataState>
      </AdminCard>
      <AdminCard title="Plant" info={PLANT_INFO}>
        <PlantFacts organization={tenant.data?.organizationName} code={tenant.data?.code} zone={zone} />
      </AdminCard>
    </SectionPage>
  );
}
