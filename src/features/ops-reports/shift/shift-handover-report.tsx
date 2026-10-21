import { useState, type ReactNode } from 'react';
import { useShiftHandover } from '@/api/v2/queries/shift-handover';
import type { ShiftHandoverView } from '@/api/v2/types/ops-reports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useShiftOptions } from '@/features/downtime-analysis/model/use-shift-options';
import { useEventHubEnv } from '@/features/event-hub/use-event-hub-env';
import { SELECT_CLASS } from '@/features/pla-analytics/components/analytics-filters';
import type { AnalyticsScope } from '@/features/pla-analytics/model/analytics-scope';
import { DataState } from '@/features/ux-kit/data-state';
import { DateInput } from '@/features/ux-kit/date-inputs/date-input';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { formatTime, useCalendarPreference } from '@/lib/dates';
import { EventStatusRows } from '../daily/event-status-rows';
import { ProductionRows } from '../daily/production-rows';
import { lastProductionDate } from '../model/month-to-date';
import { HandoverEventsTable } from './handover-events-table';
import { ShiftNotesCard } from './shift-notes-card';
import { ReportExportBar } from '../components/report-export-bar';

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <Card data-testid={testId}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function HandoverBody({ data, timeZone }: { data: ShiftHandoverView; timeZone: string }) {
  const pref = useCalendarPreference();
  if (!data.from || !data.to) return <DataState state="empty" detail="None of these units has this shift on this date." />;
  const crews = [...new Set(data.instances.flatMap((i) => (i.crewName ? [i.crewName] : [])))];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground" data-testid="handover-window">
        {formatTime(data.from, { timeZone, ...pref })} – {formatTime(data.to, { timeZone, ...pref })}
        {crews.length > 0 && ` · crew ${crews.join(', ')}`}
      </p>
      <Section title="Production by product" testId="handover-production">
        {data.production.length > 0 ? <ProductionRows rows={data.production} caption="Production by product" /> : <p className="text-sm text-muted-foreground">No calculated periods for this shift yet.</p>}
      </Section>
      <Section title="Events of the shift" testId="handover-events">
        <EventStatusRows rows={data.eventStatus} />
        <HandoverEventsTable events={data.events} timeZone={timeZone} />
        {data.eventsTruncated && <p className="text-xs text-muted-foreground">Showing the first 100 events; the Event Hub lists all of them.</p>}
      </Section>
      <ShiftNotesCard localDate={data.localDate} shiftName={data.shiftName} instances={data.instances} notes={data.notes} timeZone={timeZone} />
    </div>
  );
}

function ShiftPicker(props: { localDate: string; shiftName: string; shifts: Array<{ value: string; label: string }>; onDate: (v: string) => void; onShift: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* the plant calendar and digits, like every other date field (settings audit, 21 Oct 2026) */}
      <div className="w-44">
        <DateInput id="handover-date" label="Plant date" value={props.localDate} onChange={props.onDate} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="handover-shift">Shift</Label>
        <select id="handover-shift" className={SELECT_CLASS} value={props.shiftName} onChange={(e) => props.onShift(e.target.value)}>
          {props.shifts.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/**
 * Shift handover report (R2, operators and shift supervisors): one shift of the chosen units — its output
 * per product, its loss events and how far they are coded, and the notes for the next shift.
 */
export function ShiftHandoverReport({ scope, dayStart }: { scope: AnalyticsScope; dayStart: string }) {
  const env = useEventHubEnv();
  const shifts = useShiftOptions();
  const [localDate, setLocalDate] = useState(() => lastProductionDate(scope.to, dayStart, env.timezone) ?? '');
  const [chosenShift, setShift] = useState<string | null>(null);
  const shiftName = chosenShift ?? shifts[0]?.value ?? '';
  const ready = Boolean(localDate && shiftName);
  const unitIds = scope.unitIds.length > 0 ? [...scope.unitIds].sort() : undefined;
  const query = useShiftHandover(ready ? { localDate, shiftName, unitIds } : null);
  return (
    <div className="space-y-4" data-testid="shift-handover">
      <ReportExportBar kind="shift" query={ready ? { localDate, shiftName, unitIds } : null} formats={['pdf']} timezone={env.timezone} />
      <ShiftPicker localDate={localDate} shiftName={shiftName} shifts={shifts} onDate={setLocalDate} onShift={setShift} />
      {ready ? (
        <DataState state={dataStateOf(query)} error={query.error} onRetry={() => void query.refetch()}>
          {query.data && <HandoverBody data={query.data.data} timeZone={env.timezone} />}
        </DataState>
      ) : (
        <DataState state="empty" detail="Choose a plant date and a shift." />
      )}
    </div>
  );
}
