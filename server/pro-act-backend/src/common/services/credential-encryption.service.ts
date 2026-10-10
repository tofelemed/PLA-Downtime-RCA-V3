import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const PREFIX_V1 = 'enc:v1:';
const PREFIX_V2 = 'enc:v2:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'pro-act-salt';
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;
/** Optional provider token to inject a keyring (tests); the environment is used otherwise. */
export const CREDENTIAL_KEYRING = 'CREDENTIAL_KEYRING';

/** Key material from the environment (plan 3.11 secret rotation). */
export interface CredentialKeyring {
  /** `enc:v1:` key: CREDENTIAL_ENCRYPTION_KEY, else JWT_SECRET (kept to read values written before rotation) */
  legacyKey: Buffer;
  /** CREDENTIAL_ENCRYPTION_KEYS="id:secret,id2:secret2" */
  keys: Map<string, Buffer>;
  /** CREDENTIAL_ENCRYPTION_KEY_ID: the key new values are written with; null = keep writing `enc:v1:` */
  currentKeyId: string | null;
}

function derive(secret: string): Buffer {
  return scryptSync(secret, SALT, 32);
}

/** Reads the keyring; a malformed entry or an unknown current id fails at boot rather than at use. */
export function keyringFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): CredentialKeyring {
  const legacySecret =
    env.CREDENTIAL_ENCRYPTION_KEY ||
    env.JWT_SECRET ||
    'pro-act-default-credential-key-change-me';
  const keys = new Map<string, Buffer>();
  for (const entry of (env.CREDENTIAL_ENCRYPTION_KEYS ?? '').split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    const id = trimmed.slice(0, separator);
    const secret = trimmed.slice(separator + 1);
    if (separator <= 0 || !KEY_ID.test(id) || secret.length < 16) {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEYS entries must be "<id>:<secret of 16+ characters>"',
      );
    }
    keys.set(id, derive(secret));
  }
  const currentKeyId = env.CREDENTIAL_ENCRYPTION_KEY_ID?.trim() || null;
  if (currentKeyId && !keys.has(currentKeyId)) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY_ID "${currentKeyId}" is not in CREDENTIAL_ENCRYPTION_KEYS`,
    );
  }
  return { legacyKey: derive(legacySecret), keys, currentKeyId };
}

/**
 * AES-256-GCM for stored credentials (`secrets.ciphertext`, `pi_connections.password_encrypted`).
 *
 * - `enc:v1:<iv>:<tag>:<data>` with the legacy key (CREDENTIAL_ENCRYPTION_KEY / JWT_SECRET) — the format
 *   written until a keyring is configured
 * - `enc:v2:<keyId>:<iv>:<tag>:<data>` with a named key of CREDENTIAL_ENCRYPTION_KEYS (plan 3.11)
 *
 * Rotation: add a key, make it current (CREDENTIAL_ENCRYPTION_KEY_ID), run
 * `scripts/security/rotate-credentials.ts --apply`, then remove the old key from the environment.
 */
@Injectable()
export class CredentialEncryptionService {
  private readonly logger = new Logger(CredentialEncryptionService.name);

  private readonly keyring: CredentialKeyring;

  constructor(
    @Optional() @Inject(CREDENTIAL_KEYRING) keyring?: CredentialKeyring,
  ) {
    this.keyring = keyring ?? keyringFromEnv();
  }

  isEncrypted(value: string | undefined | null): boolean {
    return (
      !!value && (value.startsWith(PREFIX_V1) || value.startsWith(PREFIX_V2))
    );
  }

  /** True when the value is not written with the current key (rotation candidate). */
  needsRotation(value: string): boolean {
    if (!this.isEncrypted(value)) return false;
    if (!this.keyring.currentKeyId) return value.startsWith(PREFIX_V2);
    return !value.startsWith(`${PREFIX_V2}${this.keyring.currentKeyId}:`);
  }

  encrypt(plainText: string): string {
    if (!plainText) return plainText;
    if (this.isEncrypted(plainText)) return plainText;
    const keyId = this.keyring.currentKeyId;
    const key = keyId
      ? (this.keyring.keys.get(keyId) as Buffer)
      : this.keyring.legacyKey;
    const prefix = keyId ? `${PREFIX_V2}${keyId}:` : PREFIX_V1;
    return `${prefix}${seal(key, plainText)}`;
  }

  /** Decrypts with the key the value names; throws on a missing key or a tampered value. */
  decryptStrict(cipherText: string): string {
    if (cipherText.startsWith(PREFIX_V1)) {
      return open(this.keyring.legacyKey, cipherText.slice(PREFIX_V1.length));
    }
    if (!cipherText.startsWith(PREFIX_V2)) return cipherText;
    const rest = cipherText.slice(PREFIX_V2.length);
    const keyId = rest.slice(0, rest.indexOf(':'));
    const key = this.keyring.keys.get(keyId);
    if (!key) throw new Error(`Unknown credential key "${keyId}"`);
    return open(key, rest.slice(keyId.length + 1));
  }

  /** Re-encrypts a stored value with the current key (rotation). */
  reencrypt(cipherText: string): string {
    const plain = this.decryptStrict(cipherText);
    const keyId = this.keyring.currentKeyId;
    const key = keyId
      ? (this.keyring.keys.get(keyId) as Buffer)
      : this.keyring.legacyKey;
    const prefix = keyId ? `${PREFIX_V2}${keyId}:` : PREFIX_V1;
    return `${prefix}${seal(key, plain)}`;
  }

  decrypt(cipherText: string): string {
    if (!cipherText || !this.isEncrypted(cipherText)) return cipherText;
    try {
      return this.decryptStrict(cipherText);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to decrypt credential, treating as legacy plaintext: ${message}`,
      );
      return cipherText;
    }
  }
}

function seal(key: Buffer, plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  return `${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

function open(key: Buffer, payload: string): string {
  const [ivB64, authTagB64, dataB64] = payload.split(':');
  if (!ivB64 || !authTagB64 || !dataB64) {
    throw new Error('Invalid encrypted credential format');
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
