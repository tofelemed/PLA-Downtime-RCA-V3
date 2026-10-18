import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../tenant/tenant.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('query_history')
@Index(['tenantId'])
@Index(['timestamp'])
export class QueryHistory {
  @ApiProperty({ description: 'Primary key UUID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Query timestamp' })
  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @ApiProperty({ description: 'Query attributes as JSON array' })
  @Column({ type: 'text' })
  attributes: string;

  @ApiProperty({ description: 'Query parameters as JSON' })
  @Column({ name: 'query_params', type: 'text' })
  queryParams: string;

  @ApiProperty({ description: 'Result count' })
  @Column({ name: 'result_count', type: 'int' })
  resultCount: number;

  @ApiProperty({ description: 'Tenant ID' })
  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
