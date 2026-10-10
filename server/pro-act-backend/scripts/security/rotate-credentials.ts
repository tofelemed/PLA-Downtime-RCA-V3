/**
 * Plan 3.11 step 3: re-encrypt stored credentials with the current key (database from `.env`).
 *
 *   1. add a key:  CREDENTIAL_ENCRYPTION_KEYS="k2026a:<old>,k2026b:<new>"  CREDENTIAL_ENCRYPTION_KEY_ID=k2026b
 *   2. npx ts-node scripts/security/rotate-credentials.ts                         # dry run (READ ONLY)
 *   3. npx ts-node scripts/security/rotate-credentials.ts --apply --confirm-database <db>
 *   4. restart API and worker, then remove the old key (and CREDENTIAL_ENCRYPTION_KEY once no enc:v1 is left)
 *
 * Prints counts per column only, never a value. Any value that no configured key can open aborts the run.
 */
import { AppDataSource } from '../../src/database/data-source';
import { CredentialEncryptionService } from '../../src/common/services/credential-encryption.service';
import { rotateCredentials } from '../../src/common/services/credential-rotation';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const confirmIndex = args.indexOf('--confirm-database');
  const confirmed = confirmIndex >= 0 ? args[confirmIndex + 1] : undefined;
  await AppDataSource.initialize();
  try {
    const [{ db }]: Array<{ db: string }> = await AppDataSource.query(
      'SELECT current_database() AS "db"',
    );
    process.stdout.write(`Database: ${db} (${apply ? 'apply' : 'dry run'})\n`);
    if (apply && confirmed !== db) {
      throw new Error(`--apply needs --confirm-database ${db}`);
    }
    const summaries = await rotateCredentials(
      AppDataSource,
      new CredentialEncryptionService(),
      apply,
    );
    for (const s of summaries) {
      process.stdout.write(
        `${s.table}.${s.column}: ${s.encrypted} encrypted, ${s.toRotate} on an old key, ${s.rotated} re-encrypted\n`,
      );
    }
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
