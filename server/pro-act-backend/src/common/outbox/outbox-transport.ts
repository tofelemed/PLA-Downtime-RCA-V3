/** What a transport receives for one outbox row; `id` is the outbox id (consumers dedupe on it). */
export interface PublishedMessage {
  id: string;
  tenantId: string;
  aggregateType: string;
  aggregateId: string;
  type: string;
  version: number;
  payload: Record<string, unknown>;
  scope: string | null;
  createdAt: string;
}

/**
 * Where the relay sends outbox rows (D10: pluggable). Before the Kafka transport of plan 1.9 the
 * in-process bus is bound; a transport throws to make the relay retry with backoff.
 */
export interface OutboxTransport {
  readonly name: string;
  publish(message: PublishedMessage): Promise<void>;
}

export const OUTBOX_TRANSPORT = Symbol('OUTBOX_TRANSPORT');
