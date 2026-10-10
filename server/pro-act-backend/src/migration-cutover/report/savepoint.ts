import { EntityManager } from 'typeorm';

export type Guarded<T> = { ok: true; value: T } | { ok: false; error: string };

let counter = 0;

/**
 * Runs `work` behind a savepoint so one failing query (a table or column missing on an older database)
 * is reported instead of aborting the whole read-only report transaction.
 */
export async function withSavepoint<T>(
  manager: EntityManager,
  work: () => Promise<T>,
): Promise<Guarded<T>> {
  counter += 1;
  const name = `report_${counter}`;
  await manager.query(`SAVEPOINT ${name}`);
  try {
    const value = await work();
    await manager.query(`RELEASE SAVEPOINT ${name}`);
    return { ok: true, value };
  } catch (error: unknown) {
    await manager.query(`ROLLBACK TO SAVEPOINT ${name}`);
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
