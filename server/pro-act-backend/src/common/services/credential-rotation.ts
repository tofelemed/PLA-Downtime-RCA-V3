import { DataSource, EntityManager } from 'typeorm';
import { CredentialEncryptionService } from './credential-encryption.service';

/** Columns holding `enc:` values (plan 3.11 step 3). */
export const ENCRYPTED_COLUMNS: ReadonlyArray<{
  table: string;
  column: string;
}> = [
  { table: 'secrets', column: 'ciphertext' },
  { table: 'pi_connections', column: 'password_encrypted' },
];

export interface RotationSummary {
  table: string;
  column: string;
  encrypted: number;
  toRotate: number;
  rotated: number;
}

async function rotateColumn(
  manager: EntityManager,
  encryption: CredentialEncryptionService,
  target: { table: string; column: string },
  apply: boolean,
): Promise<RotationSummary> {
  const rows: Array<{ id: string; value: string }> = await manager.query(
    `SELECT "id", "${target.column}" AS "value" FROM "${target.table}" WHERE "${target.column}" LIKE 'enc:%'${apply ? ' FOR UPDATE' : ''}`,
  );
  const stale = rows.filter((row) => encryption.needsRotation(row.value));
  // decrypt everything first: a value no configured key opens aborts the whole run
  const next = stale.map((row) => ({
    id: row.id,
    value: encryption.reencrypt(row.value),
  }));
  if (apply) {
    for (const row of next) {
      await manager.query(
        `UPDATE "${target.table}" SET "${target.column}" = $2 WHERE "id" = $1`,
        [row.id, row.value],
      );
    }
  }
  return {
    ...target,
    encrypted: rows.length,
    toRotate: stale.length,
    rotated: apply ? next.length : 0,
  };
}

/**
 * Re-encrypts every stored credential that is not written with the current key, in one transaction
 * (dry run: READ ONLY, nothing written). Values are never printed or returned.
 */
export async function rotateCredentials(
  dataSource: DataSource,
  encryption: CredentialEncryptionService,
  apply: boolean,
): Promise<RotationSummary[]> {
  return dataSource.transaction(async (manager) => {
    if (!apply) await manager.query('SET TRANSACTION READ ONLY');
    const summaries: RotationSummary[] = [];
    for (const target of ENCRYPTED_COLUMNS) {
      summaries.push(await rotateColumn(manager, encryption, target, apply));
    }
    return summaries;
  });
}
