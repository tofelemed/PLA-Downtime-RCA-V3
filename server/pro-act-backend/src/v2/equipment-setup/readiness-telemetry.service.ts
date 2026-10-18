import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { stateCoverage } from '../../domain/reliability/state-coverage';
import {
  stateTimeline,
  StateSample,
} from '../../domain/reliability/unit-state';
import { IntegrationConnection } from '../../intake/entities/integration-connection.entity';
import { UnitStateMapping } from '../../reliability/entities/unit-state-mapping.entity';
import { stateConfigOf } from '../../reliability/unit-state/state-timeline.loader';
import { Signal } from '../../signals/entities/signal.entity';
import { SignalPreviewService } from '../../signals/signal-preview.service';
import {
  atSliceBoundary,
  hierarchyOf,
  measuredEntries,
} from '../../domain/actuals/period/measurement-hierarchy';
import { parseSourceAuthority } from '../../periods/policy-bodies';
import {
  check,
  coverageCheck,
  overlapping,
  windowOf,
} from './readiness-checks';
import { PolicyFacts } from './readiness-policies.service';
import { ReadinessStore } from './readiness-store';
import { EquipmentReadinessQueryDto } from './readiness-v2.dto';

const SAMPLE_LIMIT = 50_000;
@Injectable()
export class ReadinessTelemetryService {
  constructor(
    private readonly store: ReadinessStore,
    private readonly previews: SignalPreviewService,
  ) {}
  async read(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    policies: PolicyFacts,
  ) {
    const mappings = await this.store.rows(
      overlapping(
        this.store
          .query(UnitStateMapping, context, 'unitId')
          .andWhere('r.unitId = :unitId', query),
        query,
      ),
    );
    const signalQuery = overlapping(
      this.store
        .query(Signal, context, 'unitId')
        .andWhere('r.unitId = :unitId', query)
        .innerJoin(
          IntegrationConnection,
          'c',
          'c.id = r.connectionId AND c.tenantId = r.tenantId AND c.sourceType = :sourceType',
          { sourceType: 'mqtt' },
        ),
      query,
    );
    if (query.connectionId)
      signalQuery.andWhere('r.connectionId = :connectionId', query);
    const signals = await this.store.rows(signalQuery);
    const mappingCheck = coverageCheck('state_mapping', mappings, query);
    const results = await Promise.all([
      this.connection(context, query, signals),
      this.states(context, query, { mappings, signals }),
      this.output(query, { signals, policies }),
    ]);
    const effective = signals.filter(
      (signal) =>
        signal.effectiveFrom <= new Date(query.from) &&
        (!signal.effectiveTo || signal.effectiveTo >= new Date(query.to)),
    );
    const hasOutput = effective.some((signal) =>
      ['rate', 'counter', 'output_increment'].includes(signal.semanticType),
    );
    const mapped = effective.some((signal) =>
      mappings.some((mapping) => mapping.signalId === signal.id),
    );
    return [
      mappingCheck,
      check(
        'signals',
        mapped && hasOutput ? 'ready' : 'needs_attention',
        mapped && hasOutput
          ? 'Mapped physical-state and output signal definitions cover the window on the selected connection(s).'
          : 'Effective mapped state and rate/counter/output-increment definitions are required on the intended connection.',
      ),
      ...results,
    ];
  }
  private async connection(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    signals: Signal[],
  ) {
    if (!query.connectionId && !signals.length)
      return check(
        'connection',
        'missing',
        'Open a saved MQTT connection in the guide and define its unit signals.',
      );
    const ids = query.connectionId
      ? [query.connectionId]
      : [...new Set(signals.map((signal) => signal.connectionId))];
    const rows = await this.store.rows(
      this.store
        .query(IntegrationConnection, context)
        .select(['r.id', 'r.sourceType', 'r.isActive'])
        .andWhere('r.id IN (:...ids)', { ids }),
    );
    if (query.connectionId && !rows.length)
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Connection not found',
      });
    const mqtt = rows.filter(
      (row) => row.sourceType === 'mqtt' && row.isActive,
    );
    return check(
      'connection',
      mqtt.length ? 'ready' : 'needs_attention',
      mqtt.length
        ? `${mqtt.length} saved active MQTT connection(s) selected or bound to this unit. This checks configuration, not current broker reachability.`
        : 'The selected/bound connection is inactive or is not MQTT.',
    );
  }
  private async states(
    context: RequestContext,
    query: EquipmentReadinessQueryDto,
    facts: { mappings: UnitStateMapping[]; signals: Signal[] },
  ) {
    const window = windowOf(query);
    const mapping = facts.mappings.find(
      (row) =>
        row.effectiveFrom <= window.start &&
        (!row.effectiveTo || row.effectiveTo >= window.end),
    );
    if (!mapping)
      return check(
        'state_coverage',
        facts.mappings.length ? 'not_checked' : 'missing',
        'No single state-mapping version covers this window. Check the mapping timeline or use a window within one effective version.',
      );
    const signal = facts.signals.find((row) => row.id === mapping.signalId);
    if (
      !signal ||
      signal.effectiveFrom > window.start ||
      (signal.effectiveTo && signal.effectiveTo < window.end)
    )
      return check(
        'state_coverage',
        'needs_attention',
        'The mapped state signal is outside the selected connection or does not cover the full window.',
      );
    const params = [requireTenantId(context), signal.id];
    const before = await this.store.manager.query<StateRow[]>(
      `SELECT observed_at, state_name, state_value, value::text, quality FROM measurement_samples WHERE tenant_id = $1 AND signal_id = $2 AND observed_at < $3 ORDER BY observed_at DESC, inserted_at DESC, id DESC LIMIT 1`,
      [...params, window.start],
    );
    const inside = await this.store.manager.query<StateRow[]>(
      `SELECT DISTINCT ON (observed_at) observed_at, state_name, state_value, value::text, quality FROM measurement_samples WHERE tenant_id = $1 AND signal_id = $2 AND observed_at >= $3 AND observed_at < $4 ORDER BY observed_at, inserted_at DESC, id DESC LIMIT $5`,
      [...params, window.start, window.end, SAMPLE_LIMIT + 1],
    );
    if (inside.length > SAMPLE_LIMIT)
      return check(
        'state_coverage',
        'not_checked',
        'More than 50,000 state samples; select a shorter window.',
      );
    const samples = [...before, ...inside].map(
      (row): StateSample => ({
        at: new Date(row.observed_at),
        value:
          row.state_name ??
          (row.state_value !== null ? String(row.state_value) : null) ??
          (row.value !== null ? String(Number(row.value)) : null),
        quality: row.quality,
      }),
    );
    const coverage = stateCoverage(
      stateTimeline(
        samples,
        await stateConfigOf(this.store.manager, mapping),
        window,
      ),
      [window],
    );
    return check(
      'state_coverage',
      coverage.unknownSeconds === 0
        ? 'ready'
        : samples.length
          ? 'needs_attention'
          : 'missing',
      `Selected window: ${coverage.runningSeconds} s running, ${coverage.knownStoppedSeconds} s known stopped, ${coverage.unknownSeconds} s unknown. This is full-window data coverage, including unscheduled time; period KPIs apply the production schedule.`,
      coverage.coverage,
    );
  }
  private async output(
    query: EquipmentReadinessQueryDto,
    facts: { signals: Signal[]; policies: PolicyFacts },
  ) {
    if (!query.productId)
      return check(
        'output_coverage',
        'not_checked',
        'Choose a product to select its output measurement.',
      );
    const sources = facts.policies.authority;
    if (
      sources.length !== 1 ||
      coverageCheck('authority', sources, query).status !== 'ready'
    )
      return check(
        'output_coverage',
        'not_checked',
        'A single approved source-priority version must cover the window; narrow the window or inspect the period calculation across policy changes.',
      );
    const hierarchy = hierarchyOf(parseSourceAuthority(sources[0].policy.body));
    const primary = measuredEntries(hierarchy).find((entry) =>
      atSliceBoundary(hierarchy, entry),
    );
    if (primary?.source !== 'mqtt')
      return check(
        'output_coverage',
        'not_checked',
        'MQTT is not the approved primary for this window. Inspect the selected source in the actual period calculation.',
      );
    const candidates = facts.signals.filter(
      (signal) =>
        ['rate', 'counter', 'output_increment'].includes(signal.semanticType) &&
        (!signal.productId || signal.productId === query.productId) &&
        (!primary.signalSourceKey ||
          signal.sourceKey === primary.signalSourceKey),
    );
    const chosen = primary.signalSourceKey
      ? candidates
      : candidates.filter((signal) => signal.isAuthority);
    const signal =
      chosen.length === 1
        ? chosen[0]
        : candidates.length === 1
          ? candidates[0]
          : null;
    if (!signal)
      return check(
        'output_coverage',
        candidates.length ? 'needs_attention' : 'missing',
        'Output binding is missing or ambiguous. Name the intended signal in Source Priority or identify one authoritative signal.',
      );
    if (
      signal.effectiveFrom > new Date(query.from) ||
      (signal.effectiveTo && signal.effectiveTo < new Date(query.to))
    )
      return check(
        'output_coverage',
        'needs_attention',
        'The selected output signal does not cover the complete window.',
      );
    try {
      const preview = await this.previews.preview(signal, {
        from: new Date(query.from),
        to: new Date(query.to),
      });
      if (preview.quantity.engine === 'none')
        return check(
          'output_coverage',
          'needs_attention',
          'The signal cannot be quantified.',
        );
      const result = preview.quantity.result;
      if (preview.quantity.engine === 'output_events')
        return check(
          'output_coverage',
          result.quantity !== null && !result.exceptions.length
            ? 'ready'
            : 'needs_attention',
          `${signal.name}: discrete output records are evaluated; continuous time coverage cannot be inferred. Quantity ${result.quantity ?? 'unavailable'}; findings: ${result.exceptions.map((row) => row.code).join(', ') || 'none'}.`,
        );
      const quantity = preview.quantity.result;
      const ratio = Number(quantity.coverage.ratio);
      return check(
        'output_coverage',
        quantity.quantity !== null && ratio === 1 && !quantity.exceptions.length
          ? 'ready'
          : 'needs_attention',
        `${signal.name}: ${quantity.coverage.observedSeconds} s observed, ${quantity.coverage.missingSeconds} s missing; findings: ${quantity.exceptions.map((row) => row.code).join(', ') || 'none'}. Preview only; the period calculation resolves authority, conflicts, resets and accounting units.`,
        ratio,
      );
    } catch (error) {
      if (error instanceof UnprocessableEntityException)
        return check(
          'output_coverage',
          'not_checked',
          'Quantity preview exceeded its sample/window limit; select a shorter window and inspect Signals.',
        );
      throw error;
    }
  }
}
interface StateRow {
  observed_at: Date;
  state_name: string | null;
  state_value: number | null;
  value: string | null;
  quality: StateSample['quality'];
}
