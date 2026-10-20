import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantOwnedEntity } from '../common/entities/tenant-scoped.entity';
import { Unit } from '../unit/unit.entity';

export const SHIFT_NOTE_MAX = 2000;

/**
 * A shift handover note (report R2): what the outgoing shift of a unit leaves for the next one, by plant
 * date and shift label. Append-only: a correction is a new note.
 */
@Entity('shift_notes')
@Index('IDX_shift_notes_tenant_unit_shift', [
  'tenantId',
  'unitId',
  'localDate',
  'shiftName',
])
@Check('CHK_shift_notes_body', `length("body") BETWEEN 1 AND 2000`)
export class ShiftNote extends TenantOwnedEntity {
  @Column({ name: 'unit_id', type: 'uuid' })
  unitId: string;

  @ManyToOne(() => Unit, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'unit_id',
    foreignKeyConstraintName: 'FK_shift_notes_unit',
  })
  unit?: Unit;

  @Column({ name: 'local_date', type: 'date' })
  localDate: string;

  @Column({ name: 'shift_name', type: 'varchar', length: 64 })
  shiftName: string;

  @Column({ name: 'body', type: 'text' })
  body: string;
}
