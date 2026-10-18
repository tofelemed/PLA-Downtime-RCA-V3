import { CursorCodec } from '../v2/common/cursor-codec';
import { RcaOccurrenceV2ListQueryDto } from '../v2/rca/rca-links-v2.dto';
import {
  OccurrenceRow,
  occurrencePage,
  occurrencePickerParams,
} from './occurrence-picker';
import { RcaScope } from './rca-scope';

const tenantId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const occurrenceId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const eventId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const unitId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const scope: RcaScope = { tenantId, units: [unitId], userId: null };
const query = (overrides: Partial<RcaOccurrenceV2ListQueryDto>) =>
  Object.assign(new RcaOccurrenceV2ListQueryDto(), {
    limit: 50,
    ...overrides,
  });

function errorCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return (error as { response?: { code?: string } }).response?.code;
  }
  return undefined;
}

const row = (start: string): OccurrenceRow => ({
  occurrence_id: occurrenceId,
  unit_id: unitId,
  start_time: new Date(start),
  start_text: '2026-10-17 22:15:00.123456+00',
  end_time: null,
  event_count: 2,
  first_event_id: eventId,
  description: 'Screw jam',
  asset_id: null,
  asset_name: null,
  reason_code_id: null,
  reason_name: null,
  linked_rca_ids: [],
});

describe('occurrence picker (UX G-3)', () => {
  it('binds scope, filters, escaped search and limit + 1', () => {
    const params = occurrencePickerParams(
      query({
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-18T00:00:00Z',
        q: '50%_off',
        unitId,
      }),
      scope,
    );
    expect(params).toEqual([
      tenantId,
      [unitId],
      unitId,
      '2026-10-01T00:00:00Z',
      '2026-10-18T00:00:00Z',
      null,
      null,
      '%50\\%\\_off%',
      null,
      null,
      null,
      51,
    ]);
  });

  it('needs a window or an event, a window of at most 366 days, from before to', () => {
    expect(errorCode(() => occurrencePickerParams(query({}), scope))).toBe(
      'WINDOW_REQUIRED',
    );
    expect(
      errorCode(() => occurrencePickerParams(query({ eventId }), scope)),
    ).toBeUndefined();
    const long = query({
      from: '2024-01-01T00:00:00Z',
      to: '2026-01-01T00:00:00Z',
    });
    expect(errorCode(() => occurrencePickerParams(long, scope))).toBe(
      'WINDOW_TOO_LONG',
    );
    const reversed = query({
      from: '2026-10-02T00:00:00Z',
      to: '2026-10-01T00:00:00Z',
    });
    expect(errorCode(() => occurrencePickerParams(reversed, scope))).toBe(
      'INVALID_RANGE',
    );
  });

  it('pages with a cursor of the exact first start and the occurrence id', () => {
    const page = occurrencePage(
      [row('2026-10-17T22:15:00Z'), row('2026-10-16T00:00:00Z')],
      1,
    );
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      occurrenceId,
      startTime: '2026-10-17T22:15:00.000Z',
      endTime: null,
      eventCount: 2,
      firstEventId: eventId,
      linkedRcaIds: [],
    });
    const nextCursor = page.nextCursor ?? '';
    expect(CursorCodec.decode(nextCursor)).toEqual({
      sortValue: '2026-10-17 22:15:00.123456+00',
      id: occurrenceId,
    });
    const next = occurrencePickerParams(
      query({ eventId, cursor: nextCursor }),
      scope,
    );
    expect(next.slice(9, 11)).toEqual([
      '2026-10-17 22:15:00.123456+00',
      occurrenceId,
    ]);
    expect(
      occurrencePage([row('2026-10-17T22:15:00Z')], 1).nextCursor,
    ).toBeNull();
  });

  it('rejects a foreign cursor', () => {
    const cursor = CursorCodec.encode({ sortValue: null, id: occurrenceId });
    expect(
      errorCode(() =>
        occurrencePickerParams(query({ eventId, cursor }), scope),
      ),
    ).toBe('INVALID_CURSOR');
  });
});
