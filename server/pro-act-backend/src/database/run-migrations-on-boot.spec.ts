import { DataSource } from 'typeorm';
import { runMigrationsOnBoot } from './run-migrations-on-boot';

describe('runMigrationsOnBoot (TF-PREP-001 §4.6: migrations are an explicit release step)', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([{}, { DB_MIGRATIONS_RUN: 'false' }, { DB_MIGRATIONS_RUN: '1' }])(
    'does not touch the database unless DB_MIGRATIONS_RUN=true (%o)',
    async (env) => {
      const initialize = jest.spyOn(DataSource.prototype, 'initialize');
      await runMigrationsOnBoot(env);
      expect(initialize).not.toHaveBeenCalled();
    },
  );

  it('runs pending migrations in one transaction when DB_MIGRATIONS_RUN=true', async () => {
    jest.spyOn(DataSource.prototype, 'initialize').mockImplementation(function (
      this: DataSource,
    ) {
      return Promise.resolve(this);
    });
    const run = jest
      .spyOn(DataSource.prototype, 'runMigrations')
      .mockResolvedValue([]);
    const destroy = jest
      .spyOn(DataSource.prototype, 'destroy')
      .mockResolvedValue(undefined);
    await runMigrationsOnBoot({ DB_MIGRATIONS_RUN: 'true' });
    expect(run).toHaveBeenCalledWith({ transaction: 'all' });
    expect(destroy).toHaveBeenCalled();
  });
});
