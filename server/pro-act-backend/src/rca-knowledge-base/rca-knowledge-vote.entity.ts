import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantScopedEntity } from '../common/entities/tenant-scoped.entity';
import { RCAKnowledgeBase } from './rca-knowledge-base.entity';

/**
 * One person's vote on a knowledge entry (owner decision 2026-10-12): helpful or not, at most one per
 * user and entry (a repeat vote replaces the previous one). Deleted with its entry.
 */
@Entity('rca_knowledge_votes')
@Index('UQ_rca_knowledge_votes_entry_user', ['entryId', 'userId'], {
  unique: true,
})
export class RcaKnowledgeVote extends TenantScopedEntity {
  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @ManyToOne(() => RCAKnowledgeBase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry?: RCAKnowledgeBase;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'boolean' })
  helpful: boolean;
}
