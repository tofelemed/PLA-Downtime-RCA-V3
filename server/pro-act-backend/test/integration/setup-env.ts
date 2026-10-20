import * as dotenv from 'dotenv';
import * as path from 'path';

// Jest may be launched from any directory; the backend .env lives two levels up from test/integration.
// Variables already present in the environment (CI) win over the file.
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

// `npm run test:int` points the suites at the throwaway test server (docker-compose.testdb.yml) through
// TEST_DB_*, so the dev server from .env is never used for integration runs (DB audit F05).
if (process.env.TEST_DB_HOST) {
  process.env.DB_HOST = process.env.TEST_DB_HOST;
  process.env.DB_PORT = process.env.TEST_DB_PORT ?? '5432';
  process.env.DB_USERNAME = process.env.TEST_DB_USERNAME ?? 'postgres';
  process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? '';
}
