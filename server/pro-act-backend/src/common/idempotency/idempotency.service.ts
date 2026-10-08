import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import { LessThan, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { IdempotencyKey } from './idempotency-key.entity';

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
/** `response_status` while the first request is still executing */
const PENDING_STATUS = 0;
const UNIQUE_VIOLATION = '23505';

export interface StoredResponse {
  status: number;
  body: unknown;
}

export type Reservation =
  | { kind: 'new' }
  | { kind: 'replay'; response: StoredResponse }
  | { kind: 'in_progress' }
  | { kind: 'mismatch' };

/** Persists `@Idempotent()` outcomes per tenant and key (API02, 24 h retention). */
@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly keys: Repository<IdempotencyKey>,
  ) {}

  /** sha256 over method, path and the canonical (key-sorted) JSON body. */
  hashRequest(method: string, path: string, body: unknown): string {
    return createHash('sha256')
      .update(method.toUpperCase())
      .update('\n')
      .update(path)
      .update('\n')
      .update(canonicalJson(body))
      .digest('hex');
  }

  /**
   * Claims the key for this request. The insert of a pending row is what serialises concurrent
   * duplicates: the loser sees the winner's row and is told to replay, wait, or that it conflicts.
   */
  async reserve(
    tenantId: string,
    key: string,
    requestHash: string,
  ): Promise<Reservation> {
    const now = Date.now();
    try {
      await this.keys.insert({
        tenantId,
        key,
        requestHash,
        responseStatus: PENDING_STATUS,
        responseBody: () => 'NULL',
        expiresAt: new Date(now + IDEMPOTENCY_TTL_MS),
      });
      return { kind: 'new' };
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
    const existing = await this.keys.findOneBy({ tenantId, key });
    if (!existing) {
      return { kind: 'in_progress' };
    }
    if (existing.expiresAt.getTime() <= now) {
      // Expired but not yet purged: take the key over for this request
      await this.keys.update(
        { tenantId, key },
        {
          requestHash,
          responseStatus: PENDING_STATUS,
          responseBody: () => 'NULL',
          expiresAt: new Date(now + IDEMPOTENCY_TTL_MS),
        },
      );
      return { kind: 'new' };
    }
    if (existing.requestHash !== requestHash) {
      return { kind: 'mismatch' };
    }
    if (existing.responseStatus === PENDING_STATUS) {
      return { kind: 'in_progress' };
    }
    return {
      kind: 'replay',
      response: {
        status: existing.responseStatus,
        body: existing.responseBody,
      },
    };
  }

  async complete(
    tenantId: string,
    key: string,
    response: StoredResponse,
  ): Promise<void> {
    await this.keys.update(
      { tenantId, key },
      {
        responseStatus: response.status,
        responseBody: (response.body ??
          null) as QueryDeepPartialEntity<unknown>,
      },
    );
  }

  /** The handler failed: free the key so the caller can retry with the same one. */
  async abandon(tenantId: string, key: string): Promise<void> {
    await this.keys.delete({ tenantId, key, responseStatus: PENDING_STATUS });
  }

  async purgeExpired(now = new Date()): Promise<number> {
    const result = await this.keys.delete({ expiresAt: LessThan(now) });
    return result.affected ?? 0;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === UNIQUE_VIOLATION
  );
}

/** Deterministic JSON: object keys sorted recursively, undefined dropped. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value)) ?? 'null';
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        const entry = (value as Record<string, unknown>)[key];
        if (entry !== undefined) {
          acc[key] = sortKeys(entry);
        }
        return acc;
      }, {});
  }
  return value;
}
