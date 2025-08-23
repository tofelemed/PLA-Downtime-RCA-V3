import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('app_settings')
export class AppSettings {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  key: string;

  @Column({ type: 'nvarchar', length: 'max' })
  value: string;
} 