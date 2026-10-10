import { RuleFacts } from './grammar/rule-definition';

/** The event columns a rule may read (allowlist of `rule-catalog.ts`). */
export interface RuleEventSource {
  physicalType: string;
  scheduleClass: string;
  oeeComponent: string;
  impactMode: string;
  sourceKind: string;
  eventType?: string | null;
  source?: string | null;
  startTime: Date;
  endTime?: Date | null;
  reasonCodeId?: string | null;
  impactCodeId?: string | null;
  unitId: string;
  assetId?: string | null;
}

/** Whole seconds of a closed interval; open events have no duration fact. */
export function intervalSeconds(
  start: Date,
  end: Date | null | undefined,
): number | null {
  if (!end) return null;
  return Math.round((end.getTime() - start.getTime()) / 1000);
}

/** Facts of one event for the rule interpreter (absent values are null, never guessed). */
export function eventFacts(event: RuleEventSource): RuleFacts {
  return {
    physicalType: event.physicalType,
    scheduleClass: event.scheduleClass,
    oeeComponent: event.oeeComponent,
    impactMode: event.impactMode,
    sourceKind: event.sourceKind,
    eventType: event.eventType ?? null,
    source: event.source ?? null,
    durationSeconds: intervalSeconds(event.startTime, event.endTime),
    reasonCodeId: event.reasonCodeId ?? null,
    impactCodeId: event.impactCodeId ?? null,
    unitId: event.unitId,
    assetId: event.assetId ?? null,
  };
}
