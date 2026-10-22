import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCreateCrew, useCreateCrewRotation, useCrewRotations, useCrews } from '@/api/v2/queries/calendars';
import type { CrewRotationView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataTable, type DataTableColumn } from '@/features/ux-kit/data-table';
import { DateInput } from '@/features/ux-kit/date-inputs';
import { Section } from '@/features/ux-kit/page-layout';
import { useSaveFeedback } from '@/features/ux-kit/save-result';
import { formatOperationalDate, useCalendarPreference } from '@/lib/dates';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { SaveRefusalAlert } from '../components/save-refusal-alert';
import { cycleOf, cycleText } from '../model/crew-cycle';

export interface CrewRotationEditorProps {
  siteId: string | undefined;
  timezone: string;
}

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

/** A new rotation of the crew: toast and an empty form on success; the red alert above it on a refusal, input kept. */
function RotationForm({ crewId, timezone }: { crewId: string; timezone: string }) {
  const [cycle, setCycle] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const createRotation = useCreateCrewRotation();
  const feedback = useSaveFeedback();
  const addRotation = async () => {
    const body = { crewId, effectiveFrom, pattern: { anchorDate, cycle: cycleOf(cycle) } };
    const saved = await feedback.run(() => createRotation.submit(body), 'Rotation added').catch(() => null);
    if (!saved) return;
    setCycle('');
    setAnchorDate('');
    setEffectiveFrom('');
  };
  return (
    <div className="space-y-2">
      <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
      <div className="grid items-end gap-2 sm:grid-cols-4" data-testid="rotation-form">
        <FormField id="rotationCycle" label="Cycle (shift names, “-” = off)" hint="e.g. A,A,B,B,C,C,-,-">
          <Input id="rotationCycle" value={cycle} onChange={(e) => setCycle(e.target.value)} />
        </FormField>
        <DateInput id="rotationAnchor" label="Cycle day 1" value={anchorDate} onChange={setAnchorDate} />
        <DateInput id="rotationFrom" label="Effective from" value={effectiveFrom} onChange={setEffectiveFrom} />
        <Button size="sm" onClick={() => void addRotation()} disabled={!cycle || !anchorDate || !effectiveFrom || createRotation.isPending}>
          Add rotation
        </Button>
      </div>
    </div>
  );
}

/**
 * Crews and their rotations: a cycle of shift names from an anchor date. Crews only label shift instances
 * — they never change shift bounds or scheduled time (the server re-assigns future instances). Adding a crew
 * or a rotation ends in a toast and an empty field; a refusal is the red alert above the form, input kept.
 */
export function CrewRotationEditor({ siteId, timezone }: CrewRotationEditorProps) {
  const { canWriteCalendars } = useCapabilities();
  const crews = flattenPages(useCrews(siteId).data?.pages);
  const [crewId, setCrewId] = useState('');
  const [name, setName] = useState('');
  const createCrew = useCreateCrew();
  const feedback = useSaveFeedback();
  const addCrew = async () => {
    const crew = await feedback.run(() => createCrew.submit({ name, ...(siteId ? { siteId } : {}) }), 'Crew added').catch(() => null);
    if (crew) {
      setName('');
      setCrewId(crew.id);
    }
  };
  return (
    <Section title="Crews and rotations" collapsible>
      <div className="space-y-3" data-testid="crew-rotations">
        <SaveRefusalAlert error={feedback.failure} timezone={timezone} />
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="crewSelect" label="Crew">
            <NativeSelect id="crewSelect" value={crewId} options={crews.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a crew" onChange={setCrewId} />
          </FormField>
          {canWriteCalendars && (
            <>
              <FormField id="crewName" label="New crew">
                <Input id="crewName" value={name} onChange={(e) => setName(e.target.value)} />
              </FormField>
              <Button size="sm" variant="outline" onClick={addCrew} disabled={!name.trim() || createCrew.isPending} data-testid="crew-add">
                Add crew
              </Button>
            </>
          )}
        </div>
        {crewId && <RotationTable crewId={crewId} />}
        {crewId && canWriteCalendars && <RotationForm key={crewId} crewId={crewId} timezone={timezone} />}
      </div>
    </Section>
  );
}
