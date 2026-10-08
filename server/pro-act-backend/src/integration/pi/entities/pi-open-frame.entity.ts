import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { IntegrationConnection } from '../../../intake/entities/integration-connection.entity';

/**
 * Open-frame tracker (PI03, T08): every PI event frame last seen open, per connection. The
 * `open_frames` job re-reads these by WebId on every poll regardless of the search window, so a frame
 * that closes with an end time before the window (or long after the lookback) is still captured. A
 * frame leaves the tracker when it is read closed or its deletion is confirmed.
 */
@Entity('pi_open_frames')
@Unique('UQ_pi_open_frames_connection_web_id', ['connectionId', 'webId'])
@Index('IDX_pi_open_frames_connection_polled', ['connectionId', 'lastPolledAt'])
export class PiOpenFrame {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'connection_id', type: 'uuid' })
  connectionId: string;

  @ManyToOne(() => IntegrationConnection, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'connection_id' })
  connection?: IntegrationConnection;

  @Column({ name: 'web_id', type: 'text' })
  webId: string;

  @Column({ name: 'start_time', type: 'timestamptz' })
  startTime: Date;

  /** the end time exactly as PI delivered it (the sentinel), for evidence */
  @Column({ name: 'raw_end_time', type: 'text', nullable: true })
  rawEndTime: string | null;

  @Column({ name: 'last_polled_at', type: 'timestamptz', nullable: true })
  lastPolledAt: Date | null;

  @CreateDateColumn({ name: 'first_seen', type: 'timestamptz' })
  firstSeen: Date;
}
