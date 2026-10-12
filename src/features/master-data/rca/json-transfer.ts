import { v2Request } from '@/api/v2/client';
import { newIdempotencyKey } from '@/api/v2/idempotency';
import type { ListResponse } from '@/api/v2/types/envelopes';
import type { RecordResource } from '../api/record-resource';

/** Every record of a resource (all keyset pages), for an explicit export. */
export async function fetchAll<T>(source: RecordResource, query: Record<string, string> = {}): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = (await v2Request<ListResponse<T>>({ method: 'GET', path: source.path, query: { ...query, limit: 500, cursor } })).data;
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

/** Saves `data` as a pretty-printed JSON file in the browser. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** The JSON array of an uploaded file; anything else is an error with a plain message. */
export async function readJsonArray(file: File): Promise<unknown[]> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!Array.isArray(parsed)) throw new Error('The file must contain a list of records.');
  return parsed;
}

/** A string field of an imported record, or ''. */
export function textField(record: unknown, key: string): string {
  if (typeof record !== 'object' || record === null) return '';
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** One POST of an import (its own Idempotency-Key); refusals are counted by the caller, not thrown. */
export async function tryCreate<T>(source: RecordResource, body: unknown): Promise<T | null> {
  try {
    return (await v2Request<T>({ method: 'POST', path: source.path, body, idempotencyKey: newIdempotencyKey() })).data;
  } catch {
    return null;
  }
}
