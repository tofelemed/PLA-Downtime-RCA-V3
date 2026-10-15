import { v2Request } from '../client';
import type { BodyOf } from '../schema-types';
import type { StreamRunView, UnitStreamView } from '../types/plant-model';
import { v2 } from '../v2';
import { useBaselineCommand } from './profile-commands';
import { useV2InfiniteList } from './use-v2-list';

export type UnitStreamCreateBody = BodyOf<'/api/v2/unit-streams', 'post'>;
export type StreamRunCreateBody = BodyOf<'/api/v2/stream-runs', 'post'>;
export type StreamRunPatchBody = BodyOf<'/api/v2/stream-runs/{id}', 'patch'>;

/** Stream versions of a unit (SME E6); approve / retire go through `useVersionTransition`. */
export function useUnitStreams(unitId: string) {
  return useV2InfiniteList<UnitStreamView>({
    resource: 'profiles',
    path: '/unit-streams',
    query: { unitId, limit: 200 },
    key: { scope: { unitIds: [unitId] }, filters: { kind: 'unit-streams', unitId } },
    enabled: unitId !== '',
  });
}

/** Stream runs of a unit, newest first (SME E6). */
export function useStreamRuns(unitId: string) {
  return useV2InfiniteList<StreamRunView>({
    resource: 'profiles',
    path: '/stream-runs',
    query: { unitId, limit: 100 },
    key: { scope: { unitIds: [unitId] }, filters: { kind: 'stream-runs', unitId } },
    enabled: unitId !== '',
  });
}

/** A draft stream version; the unit's open periods recompute once it is approved. */
export function useCreateUnitStream() {
  return useBaselineCommand<UnitStreamCreateBody, UnitStreamView>(async (body, idempotencyKey) =>
    (await v2.post<UnitStreamView, '/api/v2/unit-streams'>('/api/v2/unit-streams', { body, idempotencyKey })).data,
  );
}

/** Records which product a stream runs; the unit's periods over the run recompute. */
export function useCreateStreamRun() {
  return useBaselineCommand<StreamRunCreateBody, StreamRunView>(async (body, idempotencyKey) =>
    (await v2.post<StreamRunView, '/api/v2/stream-runs'>('/api/v2/stream-runs', { body, idempotencyKey })).data,
  );
}

/** Ends a run or corrects its lot / notes. */
export function usePatchStreamRun() {
  return useBaselineCommand<{ id: string; body: StreamRunPatchBody }, StreamRunView>(async (input) =>
    (await v2Request<StreamRunView>({ method: 'PATCH', path: `/stream-runs/${input.id}`, body: input.body })).data,
  );
}
