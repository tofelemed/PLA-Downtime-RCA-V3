import { dbSchema, dbSsl, dbUser, schemaPoolOptions } from './connection-env';
import { dataSourceOptionsFrom, runtimeDataSourceOptions } from './data-source';

describe('database connection settings from the environment (TF-PREP-001 §4.2)', () => {
  it('prefers DB_USER over DB_USERNAME and falls back to postgres', () => {
    expect(dbUser({ DB_USER: 'forge', DB_USERNAME: 'old' })).toBe('forge');
    expect(dbUser({ DB_USERNAME: 'old' })).toBe('old');
    expect(dbUser({})).toBe('postgres');
  });

  it('sets the search_path only when DB_SCHEMA is given', () => {
    expect(schemaPoolOptions({})).toEqual({});
    expect(schemaPoolOptions({ DB_SCHEMA: 'forge' })).toEqual({
      options: '-c search_path=forge',
    });
  });

  it('rejects a schema name that is not a plain identifier', () => {
    expect(() => dbSchema({ DB_SCHEMA: 'forge; drop' })).toThrow(/DB_SCHEMA/);
    expect(() => dbSchema({ DB_SCHEMA: 'Forge' })).toThrow(/DB_SCHEMA/);
  });

  it('maps DB_SSL to the pg ssl option', () => {
    expect(dbSsl({})).toBe(false);
    expect(dbSsl({ DB_SSL: 'true' })).toEqual({ rejectUnauthorized: true });
    expect(() => dbSsl({ DB_SSL: 'yes' })).toThrow(/DB_SSL/);
  });

  it('carries schema and TLS into both the base and the runtime options', () => {
    const env = { DB_SCHEMA: 'forge', DB_SSL: 'true', DB_POOL_MAX: '7' };
    const base = dataSourceOptionsFrom(env) as unknown as {
      ssl: unknown;
      extra: Record<string, unknown>;
      database: string;
    };
    expect(base.ssl).toEqual({ rejectUnauthorized: true });
    expect(base.extra).toEqual({ options: '-c search_path=forge' });
    expect(base.database).toBe('traverse_forge');
    const runtime = runtimeDataSourceOptions(env) as unknown as {
      extra: Record<string, unknown>;
    };
    expect(runtime.extra).toMatchObject({
      options: '-c search_path=forge',
      max: 7,
    });
  });
});
