import { describe, expect, it } from 'vitest';
import { V2ApiError } from '@/api/v2/errors';
import { profileServerFieldErrors } from './profile-field-errors';

const error = (field: string) => new V2ApiError(422, { code: 'INVALID_ENDPOINT_CONFIG', message: 'Invalid profile', correlationId: null, retryable: false, fieldErrors: [{ field, message: 'Field problem' }] });

describe('profile server field ownership', () => {
  it.each([
    ['topicTemplate', 'topicTemplate'], ['schemaVersion', 'schemaVersion'], ['identityStrategy', 'identityStrategy'],
    ['time.unit', 'timeUnit'], ['time.maxFutureSkewSeconds', 'maxFutureSkewSeconds'], ['time.maxPastSeconds', 'maxPastSeconds'], ['time.onStale', 'onStale'],
    ['quality.protocol', 'qualityProtocol'], ['reasonUnmapped', 'reasonUnmapped'],
    ['fields', 'fields'], ['fields.eventId', 'fields'],
    ['valueMaps.state', 'stateMap'], ['valueMaps.state.RUN', 'stateMap'], ['valueMaps.reason', 'reasonMap'], ['valueMaps.reason.R01', 'reasonMap'],
  ])('maps the backend path %s to %s', (path, key) => {
    expect(profileServerFieldErrors(error(`endpointConfig.payloadProfile.${path}`))).toEqual({ [key]: 'Field problem' });
  });

  it('leaves whole-patch, unknown and non-API errors in the form-level refusal', () => {
    for (const field of ['payloadProfilePatch', 'endpointConfig.mqtt.topics', 'endpointConfig.payloadProfile.tenancy.expectedSite', 'endpointConfig.payloadProfile.toString', 'endpointConfig.payloadProfile.__proto__']) expect(profileServerFieldErrors(error(field))).toEqual({});
    expect(profileServerFieldErrors(new Error('offline'))).toEqual({});
  });
});
