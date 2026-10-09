import { Link } from 'react-router-dom';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCalendarVersions } from '@/api/v2/queries/calendars';
import { useSites } from '@/api/v2/queries/reference-data';
import type { CalendarVersionView } from '@/api/v2/types/calendars';
import type { ProductionPlanTemplate } from '@/services/MasterDataService';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';

export interface StepCalendarProps {
  template: Partial<ProductionPlanTemplate>;
  /** the wizard passes every step the same props; this step only reads the template's unit */
  onUpdate?: (updates: Partial<ProductionPlanTemplate>) => void;
  units?: unknown[];
  products?: unknown[];
}

function VersionLine({ version }: { version: CalendarVersionView }) {
  return (
    <li data-testid="template-calendar-version">
      {version.unitId ? 'Unit override' : 'Site calendar'} v{version.version} · {version.timezone} · day start {version.operationalDayStart} ·{' '}
      {version.shiftTemplates.map((t) => `${t.name} ${t.startLocal}–${t.endLocal}`).join(', ')} · from {version.effectiveFrom}
      {version.effectiveTo ? ` to ${version.effectiveTo}` : ''}
    </li>
  );
}

/**
 * Template wizard step while `v2.plansProfilesCalendars` is on (plan 3.4): production time comes from
 * the published calendar of the unit (or its site) instead of a weekly grid, and targets from the server
 * plan preview with approved rates — nothing here offers or derives a default rate.
 */
export function StepCalendar({ template }: StepCalendarProps) {
  const sites = useSites();
  const siteId = (sites.data?.items.find((s) => s.isDefault) ?? sites.data?.items[0])?.id;
  const unitVersions = useCalendarVersions({ unitId: template.unitId }, Boolean(template.unitId));
  const siteVersions = useCalendarVersions({ siteId }, Boolean(siteId));
  const published = [...flattenPages(unitVersions.data?.pages), ...flattenPages(siteVersions.data?.pages).filter((v) => v.unitId === null)].filter((v) => v.state === 'published');
  return (
    <div className="space-y-3" data-testid="template-step-calendar">
      <h3 className="font-medium">Calendar</h3>
      <p className="text-sm text-muted-foreground">
        Scheduled time comes from the published calendar (shifts, holidays, exclusions) — the weekly production-time grid is not used. Targets are
        previewed per shift from approved planning rates when a versioned plan is created in{' '}
        <Link className="underline" to="/planning?tab=plans">
          Plans, profiles & calendars
        </Link>
        .
      </p>
      <DataState state={dataStateOf(siteVersions, { isEmpty: published.length === 0 })} error={siteVersions.error} detail="No published calendar for this unit or its site yet: publish one under Calendars before planning.">
        <ul className="space-y-1 text-sm">
          {published.map((version) => (
            <VersionLine key={version.id} version={version} />
          ))}
        </ul>
      </DataState>
    </div>
  );
}
