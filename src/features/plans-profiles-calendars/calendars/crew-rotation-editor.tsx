import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCrewRotations, useCrews } from '@/api/v2/queries/calendars';
import type { CrewRotationView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { FIELD_CLASS } from '@/features/pla-analytics/components/filter-classes';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { EmptyMessage } from '@/features/ux-kit/data-table/data-table-states';
import { ReportLookContext } from '@/features/ux-kit/report-look';
import { Label } from '@/components/ui/label';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { Section } from '@/features/ux-kit/page-layout';
import { KpiInfo } from '@/features/pla-analytics/dashboard/kpi-info';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { ActionIcon } from '@/lib/icons';
import { NativeSelect, type Option } from '../components/native-select';
import { SETUP_LOOK } from '../model/setup-look';
import { cycleText } from '../model/crew-cycle';
import { CrewDialog } from './crew-dialog';
import { RotationDialog } from './rotation-dialog';

export interface CrewRotationEditorProps {
  siteId: string | undefined;
  timezone: string;
}

type Adding = 'crew' | 'rotation';

function RotationTable({ crewId }: { crewId: string }) {
  const pref = useCalendarPreference();
  const rotations = useCrewRotations(crewId);
  const date = (iso: string) => formatOperationalDate(iso, pref);
  const columns: DataTableColumn<CrewRotationView>[] = [
    { id: 'from', header: 'From', nowrap: true, cell: (r) => <span data-testid="rotation-row">{date(r.effectiveFrom)}</span> },
    { id: 'to', header: 'To', nowrap: true, cell: (r) => (r.effectiveTo ? date(r.effectiveTo) : 'open-ended') },
    { id: 'anchor', header: 'Cycle day 1', nowrap: true, cell: (r) => date(r.pattern.anchorDate) },
    { id: 'cycle', header: 'Shift cycle', cell: (r) => cycleText(r.pattern.cycle) },
  ];
  return (
    <div data-testid="rotation-list">
      <DataTable caption="Crew rotations" columns={columns} rows={flattenPages(rotations.data?.pages)} getRowKey={(r) => r.id} status={{ isLoading: rotations.isLoading, isError: rotations.isError, error: rotations.error }} empty={{ title: 'No rotations', text: 'No rotation for this crew yet.' }} />
    </div>
  );
}

const NO_CREW = 'Add a crew first.';

/** What the card shows instead of a rotation table: no crew yet, or none chosen. */
function NoRotations({ hasCrews }: { hasCrews: boolean }) {
  const empty = hasCrews ? { title: 'No crew chosen', text: 'Choose a crew to see its rotations.' } : { title: 'No crews', text: 'This site has no crews yet.' };
  return (
    <div className="py-6" data-testid="crew-empty">
      <EmptyMessage empty={empty} />
    </div>
  );
}

const CREWS_INFO = 'Crews only label shift instances: they never change shift bounds or scheduled time. A rotation is a cycle of shift names from its day 1.';

function AddActions({ hasCrews, onAdd }: { hasCrews: boolean; onAdd: (what: Adding) => void }) {
  return (
    <>
      <DisabledReason id="rotation-add-reason" reason={hasCrews ? null : NO_CREW} />
      <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => onAdd('crew')} data-testid="crew-add">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add crew
      </Button>
      <Button type="button" size="sm" variant="outline" className="whitespace-nowrap" onClick={() => onAdd('rotation')} disabled={!hasCrews} aria-describedby={hasCrews ? undefined : 'rotation-add-reason'} data-testid="rotation-add">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add rotation
      </Button>
    </>
  );
}

/**
 * Crews and their rotations (a card): a cycle of shift names from an anchor date. Crews only label shift
 * instances — they never change shift bounds or scheduled time (the server re-assigns future instances), said
 * behind the ⓘ. "Add crew" and "Add rotation" in the card header open dialogs (a toast and the dialog closes on
 * success; a refusal is the red alert in the dialog, input kept); the chosen crew's rotations are listed below.
 */
export function CrewRotationEditor({ siteId, timezone }: CrewRotationEditorProps) {
  const { canWriteCalendars } = useCapabilities();
  const crews = flattenPages(useCrews(siteId).data?.pages);
  const crewOptions: Option[] = crews.map((c) => ({ value: c.id, label: c.name }));
  const [crewId, setCrewId] = useState('');
  const [adding, setAdding] = useState<Adding | null>(null);
  const closeDialog = (chosen?: string) => {
    if (chosen) setCrewId(chosen);
    setAdding(null);
  };
  const actions = canWriteCalendars ? <AddActions hasCrews={crews.length > 0} onAdd={setAdding} /> : null;
  return (
    <ReportLookContext.Provider value={SETUP_LOOK}>
      <Section title="Crews and rotations" titleAside={<KpiInfo label="Crews and rotations" text={CREWS_INFO} />} collapsible actions={actions} className="rounded-lg border bg-card p-4">
        <div className="space-y-3" data-testid="crew-rotations">
          <div className={`${FIELD_CLASS} w-72`}>
            <Label htmlFor="crewSelect">Crew</Label>
            <NativeSelect id="crewSelect" value={crewId} options={crewOptions} placeholder="Choose a crew" onChange={setCrewId} />
          </div>
          {crewId ? <RotationTable crewId={crewId} /> : <NoRotations hasCrews={crews.length > 0} />}
        </div>
        {adding === 'crew' && <CrewDialog siteId={siteId} timezone={timezone} onClose={closeDialog} />}
        {adding === 'rotation' && <RotationDialog crewOptions={crewOptions} crewId={crewId} timezone={timezone} onClose={closeDialog} />}
      </Section>
    </ReportLookContext.Provider>
  );
}
