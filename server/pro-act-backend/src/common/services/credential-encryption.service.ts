import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class CredentialEncryptionService {
  private readonly logger = new Logger(CredentialEncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    const secret =
      process.env.CREDENTIAL_ENCRYPTION_KEY ||
      process.env.JWT_SECRET ||
      'pro-act-default-credential-key-change-me';
    this.key = scryptSync(secret, 'pro-act-salt', 32);
  }

  isEncrypted(value: string | undefined | null): boolean {
    return !!value && value.startsWith(PREFIX);
  }

  encrypt(plainText: string): string {
    if (!plainText) return plainText;
    if (this.isEncrypted(plainText)) return plainText;

    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
  }

  decrypt(cipherText: string): string {
    if (!cipherText) return cipherText;
    if (!this.isEncrypted(cipherText)) {
      return cipherText;
    }

    try {
      const payload = cipherText.slice(PREFIX.length);
      const [ivB64, authTagB64, dataB64] = payload.split(':');
      if (!ivB64 || !authTagB64 || !dataB64) {
        throw new Error('Invalid encrypted credential format');
      }

      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');
      const encrypted = Buffer.from(dataB64, 'base64');

      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString('utf8');
    } catch (error: any) {
      this.logger.warn(`Failed to decrypt credential, treating as legacy plaintext: ${error.message}`);
      return cipherText;
    }
  }
}
