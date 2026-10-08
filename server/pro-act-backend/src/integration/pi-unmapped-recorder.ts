import { Injectable, Logger } from '@nestjs/common';
import { MappingDiagnostic } from '../attribute-mapping/attribute-conversion';
import { ResolvedMapping } from '../source-mapping/source-mapping.service';
import { UnmappedEventService } from '../unmapped-event/unmapped-event.service';
import type { FrameContext, PiEventFrame } from './pi-frame-ingest.service';
import { piEndTimeIso } from './pi/pi-time';

/** Why a frame could not be placed, and what it looked like after mapping. */
export interface QuarantineDetails {
  attributes: Readonly<Record<string, unknown>>;
  mapped: {
    templateName: string;
    eventType: string;
    dto: Record<string, unknown>;
    diagnostics: MappingDiagnostic[];
  };
  placement: Exclude<ResolvedMapping, { status: 'mapped' }>;
}

const REASONS: Readonly<
  Record<QuarantineDetails['placement']['status'], string>
> = {
  unmapped: 'No source mapping or AF binding matches the PI element',
  ambiguous:
    'Several mappings of the same tier point at different targets (MAPPING_AMBIGUOUS)',
  invalid_target:
    'The matching mapping points at a unit or asset outside this tenant',
};

const SUGGESTIONS: Readonly<
  Record<QuarantineDetails['placement']['status'], string[]>
> = {
  unmapped: [
    'Bind the PI AF element to a unit or asset (Connectivity → AVEVA PI → AF Hierarchy)',
    'Or add a source mapping (exact id, exact path or pattern)',
  ],
  ambiguous: [
    'Give one of the candidate patterns a higher precedence, or remove the duplicate mapping',
  ],
  invalid_target: ['Point the mapping at a unit or asset of this tenant'],
};

/**
 * Quarantine of PI frames that cannot be placed (ING03): kept in `unmapped_events` with the reason, the
 * ambiguity candidates and the mapping diagnostics until the durable intake quarantine (plan 1.5).
 */
@Injectable()
export class PiUnmappedRecorder {
  private readonly logger = new Logger(PiUnmappedRecorder.name);

  constructor(private readonly unmapped: UnmappedEventService) {}

  async record(
    context: FrameContext,
    frame: PiEventFrame,
    details: QuarantineDetails,
  ): Promise<void> {
    await this.unmapped.upsertBySource({
      tenantId: context.tenantId,
      organizationId: context.organizationId,
      eventName: frame.Name ?? frame.WebId,
      eventType: details.mapped.eventType,
      startTime: frame.StartTime,
      // the open sentinel (PI03) is not an end time; the raw frame keeps it in event_data
      endTime: piEndTimeIso(frame.EndTime) ?? undefined,
      sourceSystem: 'PI',
      sourceId: frame.WebId,
      eventData: JSON.stringify(quarantinePayload(frame, details)),
    });
    this.logger.log(
      `Quarantined PI frame ${frame.WebId} for tenant ${context.tenantId}: ${details.placement.status}`,
    );
  }
}

/** What `unmapped_events.event_data` keeps for review: reason, candidates, diagnostics, the frame. */
function quarantinePayload(
  frame: PiEventFrame,
  details: QuarantineDetails,
): Record<string, unknown> {
  const { placement, mapped } = details;
  const primary = frame.PrimaryReferencedElement;
  return {
    reason: REASONS[placement.status],
    status: placement.status,
    candidates: placement.status === 'ambiguous' ? placement.candidates : [],
    suggestions: SUGGESTIONS[placement.status],
    diagnostics: mapped.diagnostics,
    event: {
      eventId: frame.WebId,
      name: frame.Name,
      template: mapped.templateName,
      eventType: mapped.eventType,
      startTime: frame.StartTime,
      endTime: frame.EndTime,
      primaryAfId: primary?.WebId,
      primaryAfPath: primary?.Path,
      source: 'PI',
      attributes: details.attributes,
      mappedFields: mapped.dto,
    },
    piWebId: frame.WebId,
    template: mapped.templateName,
    primaryAfId: primary?.WebId,
    primaryAfPath: primary?.Path,
  };
}
