/**
 * API session of one HDPE-TRAIN person: the showcase seeder's client (pacing, retries with backoff, acting
 * plant in `X-Tenant-Id`, body-derived `Idempotency-Key`) with the owner's "no demo" guard in front of
 * every request.
 */
import {
  ApiResult,
  CallOptions,
  HttpMethod,
  PersonaSession,
} from '../demo-showcase/showcase-client';
import { assertNoForbiddenWord } from './train-guard';

/** Seed of the idempotency keys: a repeated command of this seeder replays the stored answer. */
export const IDEMPOTENCY_SEED = 'marun-train-v1';

export class TrainSession extends PersonaSession {
  constructor(email: string, password: string, baseUrl: string, tenantId = '') {
    super(email, password, baseUrl, tenantId, IDEMPOTENCY_SEED);
  }

  override call<T>(
    method: HttpMethod,
    path: string,
    body?: unknown,
    options: CallOptions = {},
  ): Promise<ApiResult<T>> {
    assertNoForbiddenWord(`${method} ${path}`, { path, body });
    return super.call<T>(method, path, body, options);
  }
}
