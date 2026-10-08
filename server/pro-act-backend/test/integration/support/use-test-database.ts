/**
 * Import this FIRST in any integration spec that boots the real AppModule: `dataSourceOptions`
 * (src/database/data-source.ts) reads DB_NAME when it is first required, so the override has to be in
 * place before `./harness` or `src/app.module` are loaded. setup-env.ts has already loaded `.env` by now,
 * so this only redirects the database and turns off boot-time migrations and schedulers.
 */
process.env.DB_NAME = process.env.TEST_DB_NAME || 'proact_test';
process.env.DB_MIGRATIONS_RUN = 'false';
process.env.PROCESS_ROLE = process.env.PROCESS_ROLE || 'api';

export {};
