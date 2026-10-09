import { randomUUID } from 'crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { ExportStorage, UnsafeStorageKeyError } from './export-storage';

describe('export storage (plan 2.9)', () => {
  const storage = new ExportStorage();
  const tenant = randomUUID();
  const job = randomUUID();
  let root = '';
  const previous = process.env.EXPORT_STORAGE_DIR;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'proact-exports-'));
    process.env.EXPORT_STORAGE_DIR = root;
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.EXPORT_STORAGE_DIR;
    else process.env.EXPORT_STORAGE_DIR = previous;
  });

  it('writes to a partial file and renames it into place on commit', async () => {
    const key = storage.keyOf(tenant, job);
    const pending = await storage.openWrite(key);
    pending.stream.write('a,b\r\n');
    expect(await storage.exists(key)).toBe(false);
    await pending.commit();
    expect(await storage.exists(key)).toBe(true);
    expect(readFileSync(storage.pathOf(key), 'utf8')).toBe('a,b\r\n');
    expect(readdirSync(join(root, tenant))).toEqual([`${job}.csv`]);
    await storage.remove(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('abort leaves nothing behind', async () => {
    const pending = await storage.openWrite(storage.keyOf(tenant, job));
    pending.stream.write('partial');
    await pending.abort();
    expect(readdirSync(join(root, tenant))).toEqual([]);
  });

  it.each([
    '../../etc/passwd',
    `${tenant}/../${job}.csv`,
    `${tenant}/${job}.csv/../../x.csv`,
    `/${tenant}/${job}.csv`,
    `${tenant}\\${job}.csv`,
  ])('refuses the key %j (no traversal)', (key) => {
    expect(() => storage.pathOf(key)).toThrow(UnsafeStorageKeyError);
  });

  it('only builds keys from uuids', () => {
    expect(() => storage.keyOf('..', job)).toThrow(UnsafeStorageKeyError);
    expect(storage.keyOf(tenant, job)).toBe(`${tenant}/${job}.csv`);
  });

  it('refuses a root inside the publicly served uploads directory', () => {
    process.env.EXPORT_STORAGE_DIR = resolve('uploads', 'exports');
    expect(() => storage.root()).toThrow('uploads');
  });
});
