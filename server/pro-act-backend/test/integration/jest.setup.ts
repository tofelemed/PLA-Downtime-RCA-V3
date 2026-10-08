// Integration suites run migrations against a real Postgres in beforeAll; on a loaded machine that can take
// minutes, far beyond Jest's 5 s default for tests and hooks.
jest.setTimeout(300_000);
