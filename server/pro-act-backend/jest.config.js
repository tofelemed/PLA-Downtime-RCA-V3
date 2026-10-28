// Jest projects (plan 0.3 step 6):
//   unit         src/**/*.spec.ts, scripts/**/*.spec.ts  no I/O, runs in parallel
//   fixtures     test/fixtures/**/*.spec.ts        validates the spec §19 acceptance fixtures
//   integration  test/integration/**/*.int-spec.ts real Postgres (proact_test); run serially (--runInBand)
// Type errors are caught by `npx tsc --noEmit -p tsconfig.json`, so ts-jest runs transpile-only
// (isolatedModules) for speed.
const transform = {
  '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: { isolatedModules: true } }],
};

const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  transform,
};

/** @type {import('jest').Config} */
module.exports = {
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  projects: [
    {
      ...base,
      displayName: 'unit',
      roots: ['<rootDir>/src', '<rootDir>/scripts'],
      testRegex: '.*\\.spec\\.ts$',
    },
    {
      ...base,
      displayName: 'fixtures',
      rootDir: 'test/fixtures',
      testRegex: '.*\\.spec\\.ts$',
    },
    {
      ...base,
      displayName: 'integration',
      rootDir: 'test/integration',
      testRegex: '.*\\.int-spec\\.ts$',
      setupFiles: ['<rootDir>/setup-env.ts'],
      // `testTimeout` is not honoured inside a project config; the timeout is set in jest.setup.ts instead
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
    },
  ],
};
