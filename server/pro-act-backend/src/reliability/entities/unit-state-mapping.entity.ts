import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { AnalogThresholds } from '../../domain/reliability/analog-state';
import { StateRule } from '../../domain/reliability/unit-state';

/**
 * SME D1 / D2: how a unit's state signal maps to its physical state — signal value (state name or code)
 * → running, internal stop, planned stop / changeover, starved, blocked, standby, not scheduled — and the
 * signal's heartbeat: stale after `stale_after_intervals` × `expected_interval_seconds` + `jitter_seconds`.
 * An unmapped value, a stale signal or a bad-quality sample is unknown time (a data-quality condition,
 * never filled). Schedule status (calendar) and cause (events) stay separate attributes. Effective-dated:
 * a change is a new version.
 */
@Entity('unit_state_mappings')
@Index('UQ_unit_state_mappings_current', ['tenantId', 'unitId'], {
  unique: true,
  where: '"effective_to" IS NULL',
})
@Index('IDX_unit_state_mappings_tenant_unit_from', [
  'tenantId',
  'unitId',
  'effectiveFrom',
])
@Check(
  'CHK_unit_state_mappings_interval',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_unit_state_mappings_heartbeat',
  '"expected_interval_seconds" > 0 AND "jitter_seconds" >= 0 AND "stale_after_intervals" >= 1',
)
export class UnitStateMapping extends TenantScopedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  /** the state signal (`signals.id`, semantic type `state`) whose samples are mapped */
  @Column({ name: 'signal_id', type: 'uuid' })
  signalId: string;

  @Column({ name: 'rules', type: 'jsonb' })
  rules: StateRule[];

  /**
   * Plan 1.10 analog mapping: a numeric value no rule matches is banded — stopped / reduced rate / running
   * — by thresholds with hysteresis; reduced-rate spans become slowdown events. Null = rules only.
   */
  @Column({ name: 'thresholds', type: 'jsonb', nullable: true })
  thresholds: AnalogThresholds | null;

  @Column({ name: 'expected_interval_seconds', type: 'int' })
  expectedIntervalSeconds: number;

  @Column({ name: 'jitter_seconds', type: 'int', default: 0 })
  jitterSeconds: number;

  @Column({ name: 'stale_after_intervals', type: 'int', default: 3 })
  staleAfterIntervals: number;

  /** false = exception-based source: a quiet signal is not lost communication (no staleness) */
  @Column({ name: 'is_heartbeat', type: 'boolean', default: true })
  isHeartbeat: boolean;

  @Column({ name: 'version', type: 'int', default: 1 })
  version: number;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
