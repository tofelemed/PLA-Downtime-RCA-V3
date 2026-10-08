import { Column, Entity } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/**
 * Encrypted credential (spec §4.2, R1 decision in plan 1.5): AES-256-GCM ciphertext produced by
 * `CredentialEncryptionService` (`enc:v1:` format). Referenced as `secrets:<id>`; a vault is a later
 * swap behind the same reference. Never returned by any API.
 */
@Entity('secrets')
export class Secret extends TenantScopedEntity {
  /** e.g. `pi_password`, `mqtt_password`, `kafka_sasl` */
  @Column({ name: 'kind', type: 'varchar', length: 32 })
  kind: string;

  @Column({ name: 'ciphertext', type: 'text' })
  ciphertext: string;
}
