import { types as pgTypes } from 'pg';

/**
 * pg returns NUMERIC/DECIMAL as strings by default; the services and frontend expect numbers.
 * Every process root module (AppModule, WorkerModule) calls this before TypeORM connects.
 */
export function registerPgTypeParsers(): void {
  pgTypes.setTypeParser(pgTypes.builtins.NUMERIC, (value: string) =>
    parseFloat(value),
  );
}
