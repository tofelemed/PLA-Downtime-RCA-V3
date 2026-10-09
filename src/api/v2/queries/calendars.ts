import { ifMatchOf } from '../etag-cache';
import type { BodyOf } from '../schema-types';
import type {
  CalendarPreviewView,
  CalendarPublishView,
  CalendarVersionView,
  CrewRotationCreatedView,
  CrewRotationView,
  CrewView,
} from '../types/calendars';
import { v2 } from '../v2';
import type { ChangeNotice } from './invalidation';
import { useV2Command } from './use-v2-command';
import { useV2InfiniteList } from './use-v2-list';
import { useV2TenantId } from './use-v2-tenant';

export interface CalendarFilters {
  siteId?: string;
  unitId?: string;
}

/** Calendar versions of a site or of a unit's overrides (plan 2.1), newest last. */
export function useCalendarVersions(filters: CalendarFilters, enabled = true) {
  const query = { ...(filters.siteId ? { siteId: filters.siteId } : {}), ...(filters.unitId ? { unitId: filters.unitId } : {}) };
  return useV2InfiniteList<CalendarVersionView>({
    resource: 'calendars',
    path: '/calendar-versions',
    query: { ...query, limit: 200 },
    key: { filters: { kind: 'calendar-versions', ...query } },
    enabled,
  });
}

export function useCrews(siteId?: string) {
  return useV2InfiniteList<CrewView>({
    resource: 'crews',
    path: '/crews',
    query: { ...(siteId ? { siteId } : {}), limit: 200 },
    key: { filters: { kind: 'crews', siteId: siteId ?? null } },
  });
}

export function useCrewRotations(crewId: string | null) {
  return useV2InfiniteList<CrewRotationView>({
    resource: 'crews',
    path: '/crew-rotations',
    query: { crewId: crewId ?? undefined, limit: 200 },
    key: { filters: { kind: 'crew-rotations', crewId } },
    enabled: crewId !== null,
  });
}

function useCalendarCommand<TInput, TResult>(entityType: string, run: (input: TInput, idempotencyKey: string) => Promise<TResult>) {
  const tenantId = useV2TenantId();
  const notice = (): ChangeNotice | null => (tenantId ? { tenantId, entityType, window: null } : null);
  return useV2Command<TInput, TResult>({ run: ({ input, idempotencyKey }) => run(input, idempotencyKey), changes: notice });
}

export type CalendarCreateBody = BodyOf<'/api/v2/calendar-versions', 'post'>;
export type CalendarPatchBody = BodyOf<'/api/v2/calendar-versions/{id}', 'patch'>;
export type CalendarPreviewBody = BodyOf<'/api/v2/calendars/preview', 'post'>;

export function useCreateCalendarVersion() {
  return useCalendarCommand<CalendarCreateBody, CalendarVersionView>('calendar_version', async (body, idempotencyKey) =>
    (await v2.post<CalendarVersionView, '/api/v2/calendar-versions'>('/api/v2/calendar-versions', { body, idempotencyKey })).data,
  );
}

/** Draft edit (`If-Match`); a published version answers 409 and the editor offers a new version. */
export function usePatchCalendarVersion() {
  return useCalendarCommand<{ version: Pick<CalendarVersionView, 'id' | 'rowVersion'>; body: CalendarPatchBody }, CalendarVersionView>(
    'calendar_version',
    async (input) =>
      (await v2.patch<CalendarVersionView, '/api/v2/calendar-versions/{id}'>('/api/v2/calendar-versions/{id}', {
        path: { id: input.version.id },
        body: input.body,
        ifMatch: ifMatchOf(input.version.rowVersion),
      })).data,
  );
}

export function usePublishCalendarVersion() {
  return useCalendarCommand<{ id: string; reason?: string }, CalendarPublishView>('calendar_version', async (input, idempotencyKey) =>
    (await v2.post<CalendarPublishView, '/api/v2/calendar-versions/{id}/publish'>('/api/v2/calendar-versions/{id}/publish', {
      path: { id: input.id },
      body: input.reason ? { reason: input.reason } : {},
      idempotencyKey,
    })).data,
  );
}

/** CAL01/02 preview: instances, DST warnings and the diff — read-only, started by the user (never on render). */
export function useCalendarPreview() {
  return useV2Command<CalendarPreviewBody, CalendarPreviewView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2.post<CalendarPreviewView, '/api/v2/calendars/preview'>('/api/v2/calendars/preview', { body: input, idempotencyKey })).data,
    changes: () => null,
  });
}

export function useCreateCrew() {
  return useCalendarCommand<BodyOf<'/api/v2/crews', 'post'>, CrewView>('crew', async (body, idempotencyKey) =>
    (await v2.post<CrewView, '/api/v2/crews'>('/api/v2/crews', { body, idempotencyKey })).data,
  );
}

export function useCreateCrewRotation() {
  return useCalendarCommand<BodyOf<'/api/v2/crew-rotations', 'post'>, CrewRotationCreatedView>('crew', async (body, idempotencyKey) =>
    (await v2.post<CrewRotationCreatedView, '/api/v2/crew-rotations'>('/api/v2/crew-rotations', { body, idempotencyKey })).data,
  );
}
