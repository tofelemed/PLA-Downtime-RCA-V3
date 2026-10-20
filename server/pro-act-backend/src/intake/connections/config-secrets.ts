import { UnprocessableEntityException } from '@nestjs/common';

/** Setting names that hold credentials: never stored in `endpoint_config` (sent as `secret` instead). */
const SECRET_KEY_PATTERN = /pass(word)?|secret|token|api[-_]?key|credential/i;

/** Maps whose keys are source data (MQTT value-map tokens), not setting names. */
const DATA_KEYED_MAPS = new Set(['valueMaps']);

/**
 * Dotted paths of every setting name matching the secret pattern, at any depth (arrays included), so a
 * nested `{ auth: { password } }` is refused like a top-level one.
 */
export function secretKeyPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      secretKeyPaths(item, `${prefix}[${index}]`),
    );
  }
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (SECRET_KEY_PATTERN.test(key)) return [path];
    return DATA_KEYED_MAPS.has(key) ? [] : secretKeyPaths(nested, path);
  });
}

/** 422 `SECRET_IN_CONFIG` when an endpoint config carries a credential anywhere. */
export function assertNoSecrets(config: Record<string, unknown>): void {
  const offending = secretKeyPaths(config);
  if (offending.length === 0) return;
  throw new UnprocessableEntityException({
    code: 'SECRET_IN_CONFIG',
    message: `endpointConfig must not contain credentials (${offending.join(', ')}); send them as "secret"`,
  });
}
