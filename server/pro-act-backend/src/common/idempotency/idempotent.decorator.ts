import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'idempotent';
export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';
export const IDEMPOTENT_REPLAYED_HEADER = 'Idempotent-Replayed';

/**
 * Marks a command handler (POST) as idempotent (API02): callers must send `Idempotency-Key`;
 * the same key with the same request replays the stored response, a different request is a 409.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
