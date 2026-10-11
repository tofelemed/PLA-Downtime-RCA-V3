import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { flattenPages } from '@/api/v2/queries/use-v2-list';
import { useCalendarVersions } from '@/api/v2/queries/calendars';
import type { CalendarVersionView } from '@/api/v2/types/calendars';
import { useCapabilities } from '@/features/auth/use-capabilities';
import { DataState } from '@/features/ux-kit/data-state';
import { dataStateOf } from '@/features/ux-kit/data-state-of';
import { ReadOnlyHint } from '@/features/ux-kit/read-only-hint';
import { FormField } from '../components/form-field';
import { NativeSelect } from '../components/native-select';
import type { CalendarScope, PreviewCandidate } from '../hooks/use-calendar-editor';
import { usePlanningRefs } from '../hooks/use-planning-refs';
import { newCalendarDraft, type CalendarDraft } from '../model/calendar-draft';
import { CalendarEditor } from './calendar-editor';
import { CalendarPreviewPanel } from './calendar-preview-panel';
import { CalendarVersionList } from './calendar-version-list';
import { CrewRotationEditor } from './crew-rotation-editor';

interface Selection {
  versionId: string | null;
  /** the version as last returned by a command, until the list refetch carries it */
  known: CalendarVersionView | null;
  seed: CalendarDraft;
  /** remount key: a new target or a new stored revision resets the editor */
  key: string;
}

/**
 * Calendars (plan 3.4 step 2, CAL01/CAL02): versions of the site calendar or of a unit override, the editor
 * (drafts editable, published immutable), the server preview with DST warnings, and crews.
 */
export function CalendarsTab() {
  const { canWriteCalendars } = useCapabilities();
  const refs = usePlanningRefs();
  const [unitId, setUnitId] = useState('');
  const scope: CalendarScope = unitId ? { unitId } : refs.defaultSiteId ? { siteId: refs.defaultSiteId } : {};
  const versions = useCalendarVersions(scope, Boolean(unitId || refs.defaultSiteId));
  const items = flattenPages(versions.data?.pages).filter((v) => (unitId ? v.unitId === unitId : v.unitId === null));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [preview, setPreview] = useState<{ candidate: PreviewCandidate | null; request: number }>({ candidate: null, request: 0 });
  const listed = selection?.versionId ? items.find((v) => v.id === selection.versionId) : undefined;
  const known = selection?.known ?? null;
  const selected = listed && (!known || listed.rowVersion >= known.rowVersion) ? listed : known;
  const startNew = (seed: CalendarDraft) => setSelection({ versionId: null, known: null, seed, key: `new-${Date.now()}` });
  return (
    <div className="space-y-4" data-testid="calendars-tab">
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section className="space-y-3">
          <FormField id="calendarScope" label="Calendar of" hint="Site calendar, or a unit override (highest published version in force wins)">
            <NativeSelect id="calendarScope" value={unitId} options={refs.unitOptions} placeholder="Site (default)" onChange={(v) => { setUnitId(v); setSelection(null); }} />
          </FormField>
          {canWriteCalendars ? (
            <Button size="sm" onClick={() => startNew(newCalendarDraft(refs.timezone))} data-testid="calendar-new">
              New calendar version
            </Button>
          ) : (
            <ReadOnlyHint />
          )}
          <DataState state={dataStateOf(versions, { isEmpty: items.length === 0 })} error={versions.error} detail="No calendar versions for this scope yet.">
            <CalendarVersionList
              versions={items}
              selectedId={selection?.versionId ?? null}
              onSelect={(v) => setSelection({ versionId: v.id, known: v, seed: newCalendarDraft(refs.timezone), key: `${v.id}-${v.rowVersion}` })}
            />
          </DataState>
        </section>
        <section>
          {selection && (
            <CalendarEditor
              key={selected ? `${selected.id}-${selected.rowVersion}` : selection.key}
              version={selected}
              seed={selection.seed}
              scope={scope}
              displayTimezone={refs.timezone}
              onSaved={(saved) => setSelection({ versionId: saved.id, known: saved, seed: selection.seed, key: `${saved.id}-${saved.rowVersion}` })}
              onNewFrom={startNew}
              onPreview={(candidate) => setPreview((prev) => ({ candidate, request: prev.request + 1 }))}
            />
          )}
        </section>
      </div>
      <CalendarPreviewPanel candidate={preview.candidate} request={preview.request} unitOptions={refs.unitOptions} defaultUnitId={unitId} timezone={refs.timezone} />
      <CrewRotationEditor siteId={refs.defaultSiteId ?? undefined} timezone={refs.timezone} />
    </div>
  );
}
