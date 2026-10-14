import { Check, Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { DictionaryKind } from '../../domain/reliability/failure-dictionary';

/**
 * SME D11: one entry of a plant's ISO 14224-aligned failure dictionary, effective-dated. A change is a
 * new row (the previous one gets `effective_to`), so an event coded last year is checked and reported
 * against the entry in force at its start. Maintainable items and failure modes name their equipment
 * class by code ('' = valid for every class); equipment classes list the asset types they cover.
 */
@Entity('failure_dictionary_entries')
@Index(
  'UQ_failure_dictionary_entries_current',
  ['tenantId', 'entryKind', 'equipmentClass', 'code'],
  { unique: true, where: '"effective_to" IS NULL' },
)
@Index('IDX_failure_dictionary_entries_tenant_kind', [
  'tenantId',
  'entryKind',
  'effectiveFrom',
])
@Check(
  'CHK_failure_dictionary_entries_interval',
  '"effective_to" IS NULL OR "effective_to" > "effective_from"',
)
@Check(
  'CHK_failure_dictionary_entries_kind',
  `"entry_kind" IN ('equipment_class', 'maintainable_item', 'failure_mode', 'failure_mechanism', 'failure_cause', 'detection_method')`,
)
@Check(
  'CHK_failure_dictionary_entries_class',
  `"equipment_class" = '' OR "entry_kind" IN ('maintainable_item', 'failure_mode')`,
)
export class FailureDictionaryEntry extends TenantScopedEntity {
  @Column({ name: 'entry_kind', type: 'varchar', length: 32 })
  entryKind: DictionaryKind;

  @Column({
    name: 'equipment_class',
    type: 'varchar',
    length: 50,
    default: '',
  })
  equipmentClass: string;

  @Column({ name: 'code', type: 'varchar', length: 50 })
  code: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  /** grouping as in ISO 14224 (e.g. mechanism "Mechanical failure", cause "Design-related") */
  @Column({ name: 'category', type: 'varchar', length: 100, nullable: true })
  category: string | null;

  /** equipment classes only: the `assets.asset_type` values the class covers */
  @Column({ name: 'asset_types', type: 'jsonb', default: () => "'[]'" })
  assetTypes: string[];

  /** "unknown / investigation pending": a valid choice that says the evidence is not there yet */
  @Column({ name: 'is_pending', type: 'boolean', default: false })
  isPending: boolean;

  @Column({ name: 'effective_from', type: 'timestamptz' })
  effectiveFrom: Date;

  @Column({ name: 'effective_to', type: 'timestamptz', nullable: true })
  effectiveTo: Date | null;
}
