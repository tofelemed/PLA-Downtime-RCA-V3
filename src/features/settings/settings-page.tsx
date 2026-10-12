import { useMemo } from 'react';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { Page, PageHeader, Section } from '@/features/ux-kit/page-layout';
import { usePlantTimezone } from '@/features/ux-kit/use-plant-timezone';
import { CalendarSettingsForm } from './calendar-settings-form';
import { calendarPreferenceOf, useActingTenant } from './use-tenant-display-settings';

const ZONE_SOURCE: Record<string, string> = {
  site: 'from the default site',
  tenant: 'from the plant record',
  'utc-fallback': 'no plant timezone is configured; times show in UTC',
};

/**
 * Plant settings (replaces the old "coming soon" placeholder): how dates and numbers are shown for the
 * selected plant. The timezone is shown read-only (it is set on the plant's sites and calendars).
 */
export function SettingsPage() {
  const tenant = useActingTenant();
  const zone = usePlantTimezone();
  const { canManagePlantSettings } = useCapabilities();
  const calendar = tenant.data?.calendarSystem;
  const digits = tenant.data?.digits;
  const saved = useMemo(() => calendarPreferenceOf({ calendarSystem: calendar, digits }), [calendar, digits]);
  const state = dataStateOf(tenant);

  return (
    <Page>
      <PageHeader title="Plant settings" description={tenant.data ? `Settings of ${tenant.data.name}` : undefined} />
      <Section title="Date and number display" description="Applies to every screen of this plant, for every user. Exports stay in ISO format (UTC).">
        <DataState state={state} error={tenant.error} onRetry={() => void tenant.refetch()}>
          <CalendarSettingsForm saved={saved} timeZone={zone.timezone} canEdit={canManagePlantSettings} />
        </DataState>
      </Section>
      <Section title="Plant">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Organization</dt>
          <dd>{tenant.data?.organizationName ?? '—'}</dd>
          <dt className="text-muted-foreground">Code</dt>
          <dd>{tenant.data?.code ?? '—'}</dd>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd data-testid="plant-timezone">
            <span className="font-medium">{zone.timezone}</span>{' '}
            <span className="text-muted-foreground">({ZONE_SOURCE[zone.source]})</span>
          </dd>
        </dl>
      </Section>
    </Page>
  );
}
