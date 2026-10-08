import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { Site } from './site.entity';

/** A crew of a site (CAL02): an independent rotation over shifts, never part of the denominator. */
@Entity('crews')
@Index('UQ_crews_site_name', ['siteId', 'name'], { unique: true })
export class Crew extends TenantScopedEntity {
  @Column({ name: 'site_id', type: 'uuid' })
  siteId: string;

  @ManyToOne(() => Site, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'site_id' })
  site?: Site;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name: string;
}
