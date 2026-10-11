import { UnprocessableEntityException } from '@nestjs/common';
import { exampleMqttConfig } from '../adapters/mqtt/mqtt-config.example';
import { mergePatch, resolveProfilePatch } from './profile-merge-patch';

describe('mergePatch (RFC 7396)', () => {
  it('merges nested objects, removes keys on null and replaces scalars and arrays', () => {
    const target = { a: 1, b: { c: 2, d: 3 }, e: [1, 2], f: 'x' };
    const patched = mergePatch(target, {
      a: null,
      b: { c: 9, d: null, g: { h: 1 } },
      e: [3],
      f: { y: true },
    });
    expect(patched).toEqual({
      b: { c: 9, g: { h: 1 } },
      e: [3],
      f: { y: true },
    });
    expect(target).toEqual({ a: 1, b: { c: 2, d: 3 }, e: [1, 2], f: 'x' });
  });

  it('replaces a non-object target by the patch as a whole', () => {
    expect(mergePatch('old', { k: 1 })).toEqual({ k: 1 });
    expect(mergePatch(undefined, { k: 1 })).toEqual({ k: 1 });
    expect(mergePatch({ k: 1 }, 'flat')).toBe('flat');
  });
});

describe('resolveProfilePatch', () => {
  const connection = {
    sourceType: 'mqtt' as const,
    endpointConfig: exampleMqttConfig(),
  };

  it('is a no-op without a patch', () => {
    const change = { displayName: 'x' };
    expect(resolveProfilePatch(connection, change)).toBe(change);
  });

  it('merges into the stored payloadProfile and keeps the mqtt block (topics survive)', () => {
    const resolved = resolveProfilePatch(connection, {
      displayName: 'renamed',
      payloadProfilePatch: {
        valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
        fields: { bootId: null },
      },
    });
    expect(resolved).not.toHaveProperty('payloadProfilePatch');
    expect(resolved.displayName).toBe('renamed');
    const config = resolved.endpointConfig as Record<string, unknown>;
    expect(config.mqtt).toEqual(exampleMqttConfig().mqtt);
    expect(config.payloadProfile).toMatchObject({
      kind: 'interval_event_json',
      topicTemplate: 'proact/v1/{site}/{area}/{line}/{unit}/events',
      fields: { eventTime: 'ts', sequence: 'seq' },
      valueMaps: { state: { RUN: 'running', STOP: 'stopped' } },
    });
    expect(
      (config.payloadProfile as { fields: Record<string, string> }).fields,
    ).not.toHaveProperty('bootId');
  });

  it('refuses the patch for other source types and alongside endpointConfig', () => {
    expect(() =>
      resolveProfilePatch(
        { sourceType: 'pi_web_api', endpointConfig: {} },
        { payloadProfilePatch: {} },
      ),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      resolveProfilePatch(connection, {
        endpointConfig: exampleMqttConfig(),
        payloadProfilePatch: {},
      }),
    ).toThrow(UnprocessableEntityException);
  });
});
