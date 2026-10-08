import { Injectable } from '@nestjs/common';
import { CanonicalEnvelope } from '../envelope/canonical-envelope';
import { IngestionErrorCode } from '../entities/ingestion-exception.entity';
import { RawObservation } from '../entities/raw-observation.entity';

/** What a handler gets: the retained raw row, its envelope, and optional caller hints (pull context). */
export interface NormalizationInput {
  raw: RawObservation;
  envelope: CanonicalEnvelope;
  /** canonical event already linked to the source object, if any */
  canonicalEventId: string | null;
  hints?: unknown;
}

export type NormalizationResult =
  | {
      status: 'applied';
      /** created / updated / unchanged / retracted ... (handler-specific) */
      outcome: string;
      canonicalEventId: string | null;
      detail?: Record<string, unknown>;
    }
  | {
      status: 'quarantined';
      outcome: string;
      errorCode: IngestionErrorCode;
      detail: Record<string, unknown>;
    };

/**
 * Turns one retained record into canonical data (plan 1.5 step 6): interval events → event revisions
 * (1.2), measurements → samples (1.7), states → state observations (1.10). Must be idempotent: the same
 * raw record may be normalised again (redelivery, replay).
 */
export interface NormalizationHandler {
  readonly name: string;
  supports(envelope: CanonicalEnvelope): boolean;
  handle(input: NormalizationInput): Promise<NormalizationResult>;
}

/** Handlers by registration; feature modules register theirs on init (no module cycles). */
@Injectable()
export class NormalizationHandlerRegistry {
  private readonly handlers: NormalizationHandler[] = [];

  register(handler: NormalizationHandler): void {
    if (this.handlers.some((existing) => existing.name === handler.name))
      return;
    this.handlers.push(handler);
  }

  find(envelope: CanonicalEnvelope): NormalizationHandler | null {
    return this.handlers.find((handler) => handler.supports(envelope)) ?? null;
  }
}
