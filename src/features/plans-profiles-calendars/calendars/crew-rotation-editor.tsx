import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCrewRotations, useCrews } from '@/api/v2/queries/calendars';
import type { CrewRotationView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DisabledReason } from '@/features/ux-kit/disabled-reason';
import { Section } from '@/features/ux-kit/page-layout';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { ActionIcon } from '@/lib/icons';
import { FormField } from '../components/form-field';
import { NativeSelect, type Option } from '../components/native-select';
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
      <DataTable caption="Crew rotations" columns={columns} rows={flattenPages(rotations.data?.pages)} getRowKey={(r) => r.id} status={{ isLoading: rotations.isLoading, isError: rotations.isError, error: rotations.error }} empty={{ text: 'No rotation for this crew yet.' }} />
    </div>
  );
}

const NO_CREW = 'Add a crew first.';

function AddActions({ hasCrews, onAdd }: { hasCrews: boolean; onAdd: (what: Adding) => void }) {
  return (
    <>
      <DisabledReason id="rotation-add-reason" reason={hasCrews ? null : NO_CREW} />
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd('crew')} data-testid="crew-add">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add crew
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onAdd('rotation')} disabled={!hasCrews} aria-describedby={hasCrews ? undefined : 'rotation-add-reason'} data-testid="rotation-add">
        <ActionIcon.add className="h-4 w-4" aria-hidden="true" />
        Add rotation
      </Button>
    </>
  );
}

/**
 * Crews and their rotations: a cycle of shift names from an anchor date. Crews only label shift instances
 * — they never change shift bounds or scheduled time (the server re-assigns future instances). "Add crew" and
 * "Add rotation" in the section header open dialogs (a toast and the dialog closes on success; a refusal is
 * the red alert in the dialog, input kept); the chosen crew's rotations are listed below.
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
    <Section title="Crews and rotations" collapsible actions={actions}>
      <div className="space-y-3" data-testid="crew-rotations">
        <div className="w-72">
          <FormField id="crewSelect" label="Crew">
            <NativeSelect id="crewSelect" value={crewId} options={crewOptions} placeholder="Choose a crew" onChange={setCrewId} />
          </FormField>
        </div>
        {crewId ? <RotationTable crewId={crewId} /> : <p className="text-sm text-muted-foreground">Choose a crew to see its rotations.</p>}
      </div>
      {adding === 'crew' && <CrewDialog siteId={siteId} timezone={timezone} onClose={closeDialog} />}
      {adding === 'rotation' && <RotationDialog crewOptions={crewOptions} crewId={crewId} timezone={timezone} onClose={closeDialog} />}
    </Section>
  );
}
