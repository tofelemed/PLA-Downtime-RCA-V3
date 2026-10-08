import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { RotationPattern } from '../../domain/calendar/crew-rotation';
import { Crew } from './crew.entity';

/** Effective-dated rotation of a crew (`crew_rotations`): which shift it works on each operational date. */
@Entity('crew_rotations')
@Index('IDX_crew_rotations_crew_from', ['crewId', 'effectiveFrom'])
@Check(
  'CHK_crew_rotations_effective',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
export class CrewRotation extends TenantScopedEntity {
  @Column({ name: 'crew_id', type: 'uuid' })
  crewId: string;

  @ManyToOne(() => Crew, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crew_id' })
  crew?: Crew;

  @Column({ name: 'pattern', type: 'jsonb' })
  pattern: RotationPattern;

  @Column({ name: 'effective_from', type: 'date' })
  effectiveFrom: string;

  @Column({ name: 'effective_to', type: 'date', nullable: true })
  effectiveTo: string | null;
}
