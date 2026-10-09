import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCreateCrew, useCreateCrewRotation, useCrewRotations, useCrews } from '@/api/v2/queries/calendars';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import { RefusalNotice } from '../components/refusal-notice';
import { cycleOf, cycleText } from '../model/crew-cycle';

export interface CrewRotationEditorProps {
  siteId: string | undefined;
  timezone: string;
}

/**
 * Crews and their rotations (CAL02): a cycle of shift names from an anchor date. Crews only label shift
 * instances — they never change bounds or scheduled time (the server re-assigns future instances).
 */
export function CrewRotationEditor({ siteId, timezone }: CrewRotationEditorProps) {
  const crews = flattenPages(useCrews(siteId).data?.pages);
  const [crewId, setCrewId] = useState('');
  const [name, setName] = useState('');
  const [cycle, setCycle] = useState('');
  const [anchorDate, setAnchorDate] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const rotations = flattenPages(useCrewRotations(crewId || null).data?.pages);
  const createCrew = useCreateCrew();
  const createRotation = useCreateCrewRotation();
  const addCrew = async () => {
    const crew = await createCrew.submit({ name, ...(siteId ? { siteId } : {}) }).catch(() => null);
    if (crew) {
      setName('');
      setCrewId(crew.id);
    }
  };
  const addRotation = () =>
    createRotation.submit({ crewId, effectiveFrom, pattern: { anchorDate, cycle: cycleOf(cycle) } }).catch(() => undefined);
  return (
    <Card data-testid="crew-rotations">
      <CardHeader>
        <CardTitle className="text-base">Crews and rotations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="crewSelect" label="Crew">
            <NativeSelect id="crewSelect" value={crewId} options={crews.map((c) => ({ value: c.id, label: c.name }))} placeholder="Choose a crew" onChange={setCrewId} />
          </FormField>
          <FormField id="crewName" label="New crew">
            <Input id="crewName" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
          <Button size="sm" variant="outline" onClick={addCrew} disabled={!name.trim() || createCrew.isPending}>
            Add crew
          </Button>
        </div>
        <RefusalNotice error={createCrew.error} timezone={timezone} />
        {crewId && (
          <>
            <ul className="text-sm" data-testid="rotation-list">
              {rotations.map((r) => (
                <li key={r.id}>
                  From {r.effectiveFrom}
                  {r.effectiveTo ? ` to ${r.effectiveTo}` : ''}: anchor {r.pattern.anchorDate}, cycle {cycleText(r.pattern.cycle)}
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-4">
              <FormField id="rotationCycle" label="Cycle (shift names, “-” = off)" hint="e.g. A,A,B,B,C,C,-,-">
                <Input id="rotationCycle" value={cycle} onChange={(e) => setCycle(e.target.value)} />
              </FormField>
              <FormField id="rotationAnchor" label="Anchor date (cycle day 1)">
                <Input id="rotationAnchor" type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
              </FormField>
              <FormField id="rotationFrom" label="Effective from">
                <Input id="rotationFrom" type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
              </FormField>
              <div className="flex items-end">
                <Button size="sm" onClick={addRotation} disabled={!cycle || !anchorDate || !effectiveFrom || createRotation.isPending}>
                  Add rotation
                </Button>
              </div>
            </div>
            <RefusalNotice error={createRotation.error} timezone={timezone} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
