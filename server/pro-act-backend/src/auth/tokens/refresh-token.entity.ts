import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { User } from '../../users/user.entity';

/**
 * One issued refresh token (plan 3.11, D15 JWT hardening). The token itself is never stored: its `jti`
 * is the primary key. Tokens of one sign-in share a `family_id`; a refresh spends the presented token
 * (`used_at`) and issues the next one of the family. Presenting a spent token again revokes the whole
 * family (reuse detection), and logout revokes it too.
 */
@Entity('auth_refresh_tokens')
@Index('IDX_auth_refresh_tokens_family', ['familyId'])
@Index('IDX_auth_refresh_tokens_user', ['userId'])
@Index('IDX_auth_refresh_tokens_expires', ['expiresAt'])
export class RefreshTokenRecord {
  /** the token's `jti` claim */
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  /** `reuse` | `logout` | `user_inactive` */
  @Column({
    name: 'revoke_reason',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  revokeReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
