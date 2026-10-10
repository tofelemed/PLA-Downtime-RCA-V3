import {
  CredentialEncryptionService,
  keyringFromEnv,
} from './credential-encryption.service';

const legacyEnv = { CREDENTIAL_ENCRYPTION_KEY: 'legacy-key-0123456789' };
const rotatedEnv = {
  ...legacyEnv,
  CREDENTIAL_ENCRYPTION_KEYS:
    'k2026a:first-secret-0123456789,k2026b:second-secret-0123456789',
  CREDENTIAL_ENCRYPTION_KEY_ID: 'k2026b',
};

/** Plan 3.11 step 3: named keys, rotation and backward-compatible reads. */
describe('CredentialEncryptionService keyring', () => {
  const legacy = new CredentialEncryptionService(keyringFromEnv(legacyEnv));
  const rotated = new CredentialEncryptionService(keyringFromEnv(rotatedEnv));

  it('keeps writing enc:v1 without a keyring and reads it back', () => {
    const stored = legacy.encrypt('pi-password');
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(legacy.decrypt(stored)).toBe('pi-password');
    expect(legacy.needsRotation(stored)).toBe(false);
  });

  it('writes with the current named key and still reads enc:v1 values', () => {
    const old = legacy.encrypt('pi-password');
    const current = rotated.encrypt('pi-password');
    expect(current.startsWith('enc:v2:k2026b:')).toBe(true);
    expect(rotated.decrypt(old)).toBe('pi-password');
    expect(rotated.decrypt(current)).toBe('pi-password');
    expect(rotated.needsRotation(old)).toBe(true);
    expect(rotated.needsRotation(current)).toBe(false);
  });

  it('re-encrypts with the current key and fails loudly once the old key is gone', () => {
    const withA = new CredentialEncryptionService(
      keyringFromEnv({ ...rotatedEnv, CREDENTIAL_ENCRYPTION_KEY_ID: 'k2026a' }),
    ).encrypt('secret');
    const moved = rotated.reencrypt(withA);
    expect(moved.startsWith('enc:v2:k2026b:')).toBe(true);
    const withoutA = new CredentialEncryptionService(
      keyringFromEnv({
        ...legacyEnv,
        CREDENTIAL_ENCRYPTION_KEYS: 'k2026b:second-secret-0123456789',
        CREDENTIAL_ENCRYPTION_KEY_ID: 'k2026b',
      }),
    );
    expect(withoutA.decrypt(moved)).toBe('secret');
    expect(() => withoutA.decryptStrict(withA)).toThrow(
      'Unknown credential key "k2026a"',
    );
  });

  it('rejects a malformed keyring or an unknown current key at boot', () => {
    expect(() =>
      keyringFromEnv({ CREDENTIAL_ENCRYPTION_KEYS: 'nokey' }),
    ).toThrow();
    expect(() =>
      keyringFromEnv({
        CREDENTIAL_ENCRYPTION_KEYS: 'a:0123456789abcdef',
        CREDENTIAL_ENCRYPTION_KEY_ID: 'b',
      }),
    ).toThrow();
  });

  it('detects tampering', () => {
    const stored = rotated.encrypt('secret');
    const tampered = `${stored.slice(0, -4)}AAAA`;
    expect(() => rotated.decryptStrict(tampered)).toThrow();
  });
});
