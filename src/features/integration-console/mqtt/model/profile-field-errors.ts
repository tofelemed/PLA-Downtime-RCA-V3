import { V2ApiError } from '@/api/v2/errors';
import type { ProfileDraft } from './profile-draft';

export type ProfileFieldErrors = Partial<Record<keyof ProfileDraft, string>>;

const FIELDS: Record<string, keyof ProfileDraft> = {
  topicTemplate: 'topicTemplate', schemaVersion: 'schemaVersion', identityStrategy: 'identityStrategy',
  'time.unit': 'timeUnit', 'time.maxFutureSkewSeconds': 'maxFutureSkewSeconds',
  'time.maxPastSeconds': 'maxPastSeconds', 'time.onStale': 'onStale',
  'quality.protocol': 'qualityProtocol', reasonUnmapped: 'reasonUnmapped',
};

/** Server paths describe the merged profile, even when the request sent a merge patch. */
export function profileServerFieldErrors(error: unknown): ProfileFieldErrors {
  if (!(error instanceof V2ApiError)) return {};
  const errors: ProfileFieldErrors = {};
  for (const entry of error.fieldErrors) {
    const prefix = 'endpointConfig.payloadProfile.';
    if (!entry.field.startsWith(prefix)) continue;
    const path = entry.field.slice(prefix.length);
    const key = Object.prototype.hasOwnProperty.call(FIELDS, path) ? FIELDS[path] : mapField(path);
    if (key) errors[key] = [errors[key], entry.message].filter(Boolean).join('; ');
  }
  return errors;
}

function mapField(path: string): keyof ProfileDraft | null {
  if (path === 'fields' || path.startsWith('fields.')) return 'fields';
  if (path === 'valueMaps.state' || path.startsWith('valueMaps.state.')) return 'stateMap';
  if (path === 'valueMaps.reason' || path.startsWith('valueMaps.reason.')) return 'reasonMap';
  return null;
}
