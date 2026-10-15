import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import {
  DerivedSlowdown,
  deriveSlowdowns,
  describeSlowdown,
} from '../../domain/reliability/derived-slowdowns';
import {
  DerivedStop,
  deriveStops,
} from '../../domain/reliability/derived-stops';
import { describeStop } from '../../domain/reliability/derived-stop-writes';
import { assertBodyUnitsInScope } from '../../periods/period-scope';
import {
  StopEventOptions,
  stopEventSettings,
} from '../../periods/stop-event-options';
import { loadStateInputs } from '../../reliability/unit-state/state-timeline.loader';
import { StopEventSettingsService } from '../../stop-events/stop-event-settings.service';
import {
  OeePolicyVersionsService,
  PolicyInForce,
} from '../reliability/oee-policy-versions.service';
import { windowOf } from '../reliability/reliability-v2-common';
import {
  DerivedStopPreviewQueryDto,
  StopEventPolicyCreateDto,
} from './stop-events-v2.dto';

const MAX_PREVIEW_MS = 7 * 86_400_000;

export interface StopEventPolicyV2View extends StopEventOptions {
  /** `oee_policy` version id */
  id: string;
  unitId: string | null;
  version: number;
  effectiveFrom: string;
  notes: string | null;
}

export interface DerivedStopPreviewV2View {
  unitId: string;
  from: string;
  to: string;
  /** false = the unit has no state mapping at `from` */
  mapped: boolean;
  settings: StopEventOptions;
  stops: Array<{
    key: string;
    occurrenceKey: string;
    state: DerivedStop['state'];
    scheduleClass: DerivedStop['scheduleClass'];
    startTime: string;
    endTime: string | null;
    description: string;
  }>;
  /** plan 1.10 reduced-rate spans the engine would record as slowdown (performance) events */
  slowdowns: Array<{
    key: string;
    startTime: string;
    endTime: string | null;
    meanValue: number | null;
    fraction: string | null;
    description: string;
  }>;
}

const stopView = (s: DerivedStop) => ({
  key: s.key,
  occurrenceKey: s.occurrenceKey,
  state: s.state,
  scheduleClass: s.scheduleClass,
  startTime: s.start.toISOString(),
  endTime: s.end?.toISOString() ?? null,
  description: describeStop(s),
});

const slowdownView = (s: DerivedSlowdown) => ({
  key: s.key,
  startTime: s.start.toISOString(),
  endTime: s.end?.toISOString() ?? null,
  meanValue: s.meanValue,
  fraction: s.fraction,
  description: describeSlowdown(s),
});

const toView = ({ row, body }: PolicyInForce): StopEventPolicyV2View => ({
  ...stopEventSettings(body),
  id: row.id,
  unitId: row.unitId,
  version: row.version,
  effectiveFrom: row.effectiveFrom.toISOString(),
  notes: row.notes,
});

const SETTING_KEYS = [
  'deriveFromState',
  'debounceSeconds',
  'restartConfirmSeconds',
  'duplicateToleranceSeconds',
  'autoMergeDuplicates',
  'incidentWindowSeconds',
] as const;

/**
 * Plan 1.10 / DT-04 / SME D5 stop-event settings over HTTP (the `stopEvents` part of `oee_policy`, a new
 * approved version effective now, every other field kept) and the rule preview of plan 1.10 step 6: the
 * stops the state engine would derive for a unit and window, without writing anything.
 */
@Injectable()
export class StopEventPolicyV2Service {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly versions: OeePolicyVersionsService,
    private readonly settings: StopEventSettingsService,
  ) {}

  async current(context: RequestContext, unitId: string | undefined) {
    return toView(await this.versions.current(context, unitId));
  }

  async create(context: RequestContext, dto: StopEventPolicyCreateDto) {
    const stated: Partial<StopEventOptions> = {};
    for (const key of SETTING_KEYS) {
      if (dto[key] !== undefined) Object.assign(stated, { [key]: dto[key] });
    }
    const written = await this.versions.write(context, dto, (base) => ({
      ...base,
      stopEvents: { ...(base.stopEvents ?? {}), ...stated },
    }));
    return toView(written);
  }

  async preview(
    context: RequestContext,
    query: DerivedStopPreviewQueryDto,
  ): Promise<DerivedStopPreviewV2View> {
    assertBodyUnitsInScope(context, [query.unitId], 'unitId');
    const window = windowOf(query.from, query.to);
    if (window.end.getTime() - window.start.getTime() > MAX_PREVIEW_MS) {
      throw new UnprocessableEntityException({
        code: 'INVALID_RANGE',
        message: 'The preview window is at most 7 days',
      });
    }
    const scope = { tenantId: requireTenantId(context), unitId: query.unitId };
    const { settings } = await this.settings.resolve(
      this.manager,
      scope,
      window.end,
    );
    const inputs = await loadStateInputs(this.manager, scope, window);
    const timeline = inputs?.segments ?? null;
    const stops = timeline ? deriveStops(timeline, settings, window.end) : [];
    const slowdowns = inputs
      ? deriveSlowdowns(inputs.segments, inputs.samples, {
          config: settings,
          ratedValue: inputs.config.thresholds?.ratedValue ?? null,
          liveEdge: window.end,
        })
      : [];
    return {
      unitId: query.unitId,
      from: window.start.toISOString(),
      to: window.end.toISOString(),
      mapped: timeline !== null,
      settings,
      stops: stops.map(stopView),
      slowdowns: slowdowns.map(slowdownView),
    };
  }
}
