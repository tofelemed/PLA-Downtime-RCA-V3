import { describe, expect, it } from 'vitest';
import type { CalendarPublishView } from '@/api/v2/types/calendars';
import type { RateImportView } from '@/api/v2/types/profiles';
import { calendarPublishedResult } from './calendars/calendar-published-result';
import { rateImportResult } from './profiles/rate-import-result';

const PUBLISHED = { version: { version: 3, unitId: 'u1' }, materialization: [] } as unknown as CalendarPublishView;
const IMPORTED = { kind: 'forecast', externalId: 'FC-1', revision: 2, counts: { rows: 1, inserted: 1, retired: 0 } } as unknown as RateImportView;
const count = (value: number) => String(value);

// SETUP_UX_FIXES Phase 5: "Back to list" of a result dialog is the list as the user left it (`?back=`)
describe('result dialogs return to the filtered list', () => {
  it('calendar published: the handed-over list address, else the calendars list', () => {
    const base = { result: PUBLISHED, scopeLabel: 'Unit override · Extruder 1', count, unitName: () => 'Extruder 1', next: null };
    expect(calendarPublishedResult({ ...base, listPath: '/setup/calendars?unitId=u1' }).listPath).toBe('/setup/calendars?unitId=u1');
    expect(calendarPublishedResult(base).listPath).toBe('/setup/calendars');
  });

  it('rate import: the handed-over list address, else Profiles & rates', () => {
    const base = { view: IMPORTED, count, next: null, onAddAnother: () => undefined };
    expect(rateImportResult({ ...base, listPath: '/setup/profiles?tab=profiles&unitId=u1' }).listPath).toBe('/setup/profiles?tab=profiles&unitId=u1');
    expect(rateImportResult(base).listPath).toBe('/setup/profiles');
  });
});
