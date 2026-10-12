import { useQueryClient } from '@tanstack/react-query';
import { v2Request } from '@/api/v2/client';
import { ifMatchOf } from '@/api/v2/etag-cache';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useV2Command } from '@/api/v2/queries/use-v2-command';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RecordResource } from './record-resource';

interface RevisionedRecord {
  id: string;
  rowVersion: number;
}

export interface ChangeInput<TBody> {
  record: RevisionedRecord;
  body: TBody;
}

/** Shared invalidation: every list of the resource plus the overview counts (`master-data`). */
function useRecordCommand<TInput, TResult extends { id: string }>(
  source: RecordResource,
  run: (input: TInput, idempotencyKey: string) => Promise<TResult>,
) {
  const tenantId = useV2TenantId();
  const queryClient = useQueryClient();
  return useV2Command<TInput, TResult>({
    run: ({ input, idempotencyKey }) => run(input, idempotencyKey),
    changes: (_input, result) => {
      if (!tenantId) return null;
      queryClient.setQueryData(v2Keys.detail(tenantId, source.resource, result.id, source.path), result);
      return { tenantId, entityType: source.entityType, entityId: result.id };
    },
  });
}

/** POST a new record (Idempotency-Key; retries replay instead of creating twice). */
export function useCreateRecord<TBody, TResult extends { id: string }>(source: RecordResource) {
  return useRecordCommand<TBody, TResult>(source, async (body, idempotencyKey) =>
    (await v2Request<TResult>({ method: 'POST', path: source.path, body, idempotencyKey })).data,
  );
}

/** PATCH a record under If-Match (412 when someone changed it since it was read). */
export function useChangeRecord<TBody, TResult extends { id: string }>(source: RecordResource) {
  return useRecordCommand<ChangeInput<TBody>, TResult>(source, async ({ record, body }) =>
    (await v2Request<TResult>({
      method: 'PATCH',
      path: `${source.path}/${record.id}`,
      body,
      ifMatch: ifMatchOf(record.rowVersion),
    })).data,
  );
}

/** POST `/{id}/retire` or `/{id}/restore`. */
export function useRecordLifecycle<TResult extends { id: string }>(source: RecordResource, action: 'retire' | 'restore') {
  return useRecordCommand<{ id: string }, TResult>(source, async ({ id }, idempotencyKey) =>
    (await v2Request<TResult>({ method: 'POST', path: `${source.path}/${id}/${action}`, body: {}, idempotencyKey })).data,
  );
}
