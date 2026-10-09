import { randomUUID } from 'crypto';
import { getRequestContext } from '../context/request-context';

/** Who and what a domain message is about (spec §15.4). */
export interface DomainEventSubject {
  tenantId: string;
  entityType: string;
  entityId: string;
  entityRevision: number;
}

/** The common v1 fields of a domain message; `domainEventId` is new for every message (consumers dedupe on it). */
export interface DomainEventEnvelope extends DomainEventSubject {
  schemaVersion: 1;
  domainEventId: string;
  occurredAt: string;
  correlationId: string | null;
}

/**
 * Envelope fields of a domain message written now; the correlation id is the ambient request's (null in
 * jobs and consumers, which have no request).
 */
export function domainEnvelope(
  subject: DomainEventSubject,
  occurredAt: Date = new Date(),
): DomainEventEnvelope {
  return {
    schemaVersion: 1,
    domainEventId: randomUUID(),
    ...subject,
    occurredAt: occurredAt.toISOString(),
    correlationId: getRequestContext()?.correlationId || null,
  };
}
