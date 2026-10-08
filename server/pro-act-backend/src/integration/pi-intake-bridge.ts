import { Injectable } from '@nestjs/common';
import { IntegrationConnectionService } from '../intake/connections/integration-connection.service';
import { IntakeService } from '../intake/intake.service';
import { NormalizationService } from '../intake/normalization/normalization.service';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { piFrameEnvelope } from './pi-envelope';
import {
  FrameContext,
  FrameOutcome,
  FrameResult,
  PiEventFrame,
} from './pi-frame-ingest.service';
import { PiNormalizationHints } from './pi-interval.handler';

/** One pull: the mapping context plus the intake identity of the PI connection. */
export interface PiPullScope {
  context: FrameContext;
  connectionId: string;
  correlationId: string;
}

/**
 * The PI pull inside the durable pipeline (plan 1.5): frame → canonical envelope → `IntakeService.accept`
 * (raw retained, source object updated, `RawAccepted` in the outbox) → normalised inline under the same
 * inbox key the relay would use, so the v1 pull still answers with created/updated/unmapped counts and
 * the later relay delivery is a no-op.
 */
@Injectable()
export class PiIntakeBridge {
  constructor(
    private readonly intake: IntakeService,
    private readonly normalization: NormalizationService,
    private readonly connections: IntegrationConnectionService,
  ) {}

  /** Mirrors the v1 connection into `integration_connections` (same id) before the first accept. */
  async prepare(tenantId: string, connection: PIConnection): Promise<void> {
    await this.connections.mirrorPiConnection(tenantId, connection);
  }

  async ingestFrame(
    pull: PiPullScope,
    frame: PiEventFrame,
    attributes: Record<string, unknown>,
  ): Promise<FrameResult> {
    const binding = {
      tenantId: pull.context.tenantId,
      connectionId: pull.connectionId,
    };
    const envelope = piFrameEnvelope(
      binding,
      { frame, attributes },
      { at: new Date(), correlationId: pull.correlationId },
    );
    const accepted = await this.intake.accept(binding, envelope);
    if (!accepted.ticket) {
      return {
        outcome: accepted.status === 'invalid' ? 'unmapped' : 'unchanged',
        diagnostics: [],
      };
    }
    const hints: PiNormalizationHints = { frameContext: pull.context };
    const run = await this.normalization.normalize(accepted.ticket, hints);
    if (run.status === 'duplicate')
      return { outcome: 'unchanged', diagnostics: [] };
    const result = run.result;
    const diagnostics = (result.detail?.diagnostics ??
      []) as FrameResult['diagnostics'];
    if (result.status === 'quarantined') {
      // a crashed normaliser is an error of this frame for the v1 pull report, as before 1.5
      if (result.errorCode === 'processing_failed') {
        const reason = result.detail.reason;
        throw new Error(
          typeof reason === 'string' ? reason : 'normalisation failed',
        );
      }
      return { outcome: 'unmapped', diagnostics };
    }
    return { outcome: frameOutcome(result.outcome), diagnostics };
  }
}

function frameOutcome(outcome: string): FrameOutcome {
  return outcome === 'created' || outcome === 'updated' ? outcome : 'unchanged';
}
