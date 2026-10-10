import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  RequestContext,
  requireTenantId,
} from '../../common/context/request-context';
import { assertRevision } from '../../common/concurrency/revision';
import { CredentialEncryptionService } from '../../common/services/credential-encryption.service';
import { AdapterRegistry } from '../adapters/adapter-registry';
import {
  ConnectionTest,
  SampleRequest,
  SourceSample,
} from '../adapters/adapter.interface';
import { SourceType } from '../envelope/canonical-envelope';
import { canonicalJson } from '../envelope/envelope-validator';
import { IntegrationConnection } from '../entities/integration-connection.entity';
import { Secret } from '../entities/secret.entity';
import {
  assertNotLegacyMirror,
  ConnectionChange,
  pickChange,
  sourceFailure,
} from './connection-change';

export type { ConnectionChange } from './connection-change';

const SECRET_REF_PREFIX = 'secrets:';
/** Endpoint configuration keys that look like credentials (they belong in `secret`). */
const SECRET_KEY_PATTERN = /pass(word)?|secret|token|api[-_]?key|credential/i;

export interface NewConnection {
  sourceType: SourceType;
  displayName: string;
  endpointConfig: Record<string, unknown>;
  secret?: string;
  isActive?: boolean;
}

/** The fields of a v1 `pi_connections` row the mirror copies. */
export interface PiConnectionSource {
  id: string;
  connectionName: string;
  piWebApiUrl: string;
  username?: string | null;
  afDatabasePath?: string | null;
  passwordEncrypted?: string | null;
  /** v1 JSON settings; `insecureSkipTlsVerify: true` becomes `allowInsecureTls` */
  connectionConfig?: string | null;
  isActive: boolean;
}

/**
 * Source-neutral connections (plan 1.5 step 7, §14.2): tenant-scoped reads, creation with the secret
 * stored encrypted in `secrets` (never in `endpoint_config`, never returned), adapter test/discovery,
 * and the expand-phase mirror of v1 PI connections (same id, refreshed on every pull).
 */
@Injectable()
export class IntegrationConnectionService {
  constructor(
    @InjectRepository(IntegrationConnection)
    private readonly connections: Repository<IntegrationConnection>,
    private readonly encryption: CredentialEncryptionService,
    private readonly adapters: AdapterRegistry,
  ) {}

  /** A connection of the caller's tenant; 404 for foreign or unknown ids. */
  async get(
    context: RequestContext,
    id: string,
  ): Promise<IntegrationConnection> {
    return this.forTenant(requireTenantId(context), id);
  }

  async forTenant(
    tenantId: string,
    id: string,
  ): Promise<IntegrationConnection> {
    const found = await this.connections.findOneBy({ id, tenantId });
    if (found) return found;
    throw new NotFoundException({
      code: 'NOT_FOUND',
      message: 'Connection not found',
    });
  }

  async create(
    context: RequestContext,
    input: NewConnection,
  ): Promise<IntegrationConnection> {
    const tenantId = requireTenantId(context);
    this.assertValidConfig(input.sourceType, input.endpointConfig);
    return this.connections.manager.transaction(async (manager) => {
      const secretRef = input.secret
        ? await this.storeSecret(manager, tenantId, {
            kind: `${input.sourceType}_secret`,
            ciphertext: this.encryption.encrypt(input.secret),
          })
        : null;
      return manager.save(
        manager.create(IntegrationConnection, {
          tenantId,
          sourceType: input.sourceType,
          displayName: input.displayName,
          endpointConfig: input.endpointConfig,
          secretRef,
          capabilities:
            this.adapters.find(input.sourceType)?.capabilities() ?? {},
          isActive: input.isActive ?? true,
          createdBy: context.userId,
          updatedBy: context.userId,
        }),
      );
    });
  }

  async test(context: RequestContext, id: string): Promise<ConnectionTest> {
    const connection = await this.get(context, id);
    return this.adapters.get(connection.sourceType).test(connection);
  }

  /** Adapter capabilities and source metadata; a classified source failure is 502 with its code. */
  async discover(
    context: RequestContext,
    id: string,
  ): Promise<Record<string, unknown>> {
    const connection = await this.get(context, id);
    const adapter = this.adapters.get(connection.sourceType);
    return {
      capabilities: adapter.capabilities(),
      metadata: await adapter.discover(connection).catch(sourceFailure),
    };
  }

  /** Bounded discovery read (plan 3.7); 422 SAMPLE_UNSUPPORTED when the adapter cannot sample. */
  async sample(
    context: RequestContext,
    id: string,
    request: SampleRequest,
  ): Promise<SourceSample> {
    const connection = await this.get(context, id);
    const adapter = this.adapters.get(connection.sourceType);
    if (!adapter.sample) {
      throw new UnprocessableEntityException({
        code: 'SAMPLE_UNSUPPORTED',
        message: `The ${connection.sourceType} adapter cannot sample records`,
      });
    }
    return adapter.sample(connection, request).catch(sourceFailure);
  }

  /**
   * Changes a v2 connection under `If-Match` (plan 3.7): a new endpoint configuration is validated like
   * on create, a new secret replaces the stored ciphertext (never returned), and either bumps
   * `configVersion`. Mirrors of v1 PI connections are edited through v1 (409 LEGACY_CONNECTION).
   */
  async update(
    context: RequestContext,
    target: { id: string; expectedRevision: number },
    change: ConnectionChange,
  ): Promise<IntegrationConnection> {
    const tenantId = requireTenantId(context);
    return this.connections.manager.transaction(async (manager) => {
      const connection = await manager.findOne(IntegrationConnection, {
        where: { id: target.id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!connection) return this.forTenant(tenantId, target.id);
      assertRevision(connection.rowVersion, target.expectedRevision);
      await assertNotLegacyMirror(manager, connection.id);
      if (change.endpointConfig) {
        this.assertValidConfig(connection.sourceType, change.endpointConfig);
      }
      const configChanged =
        change.secret !== undefined ||
        (change.endpointConfig !== undefined &&
          canonicalJson(change.endpointConfig) !==
            canonicalJson(connection.endpointConfig));
      if (change.secret !== undefined) {
        connection.secretRef = await this.replaceSecret(
          manager,
          connection,
          change.secret,
        );
      }
      Object.assign(connection, pickChange(change), {
        configVersion: connection.configVersion + (configChanged ? 1 : 0),
        updatedBy: context.userId,
      });
      return manager.save(connection);
    });
  }

  /** Decrypted secret of a connection (adapters only; never returned by an API). */
  async revealSecret(
    connection: IntegrationConnection,
  ): Promise<string | null> {
    if (!connection.secretRef?.startsWith(SECRET_REF_PREFIX)) return null;
    const secret = await this.connections.manager.findOneBy(Secret, {
      id: connection.secretRef.slice(SECRET_REF_PREFIX.length),
      tenantId: connection.tenantId,
    });
    return secret ? this.encryption.decrypt(secret.ciphertext) : null;
  }

  /** Upserts the `integration_connections` copy of a v1 PI connection (same id; expand step). */
  async mirrorPiConnection(
    tenantId: string,
    pi: PiConnectionSource,
  ): Promise<IntegrationConnection> {
    return this.connections.manager.transaction(async (manager) => {
      const existing = await manager.findOneBy(IntegrationConnection, {
        id: pi.id,
      });
      const secretRef = await this.mirrorSecret(manager, tenantId, {
        currentRef: existing?.secretRef ?? null,
        ciphertext: pi.passwordEncrypted ?? null,
      });
      const fields = {
        tenantId,
        sourceType: 'pi_web_api' as const,
        displayName: pi.connectionName,
        endpointConfig: piEndpoint(pi),
        secretRef,
        capabilities: this.adapters.find('pi_web_api')?.capabilities() ?? {},
        isActive: pi.isActive,
      };
      if (existing && sameMirror(existing, fields)) return existing;
      return manager.save(
        Object.assign(
          existing ?? manager.create(IntegrationConnection, { id: pi.id }),
          fields,
        ),
      );
    });
  }

  private async mirrorSecret(
    manager: EntityManager,
    tenantId: string,
    input: { currentRef: string | null; ciphertext: string | null },
  ): Promise<string | null> {
    if (!input.ciphertext) return null;
    const currentId = input.currentRef?.startsWith(SECRET_REF_PREFIX)
      ? input.currentRef.slice(SECRET_REF_PREFIX.length)
      : null;
    const current = currentId
      ? await manager.findOneBy(Secret, { id: currentId, tenantId })
      : null;
    if (current?.ciphertext === input.ciphertext) return input.currentRef;
    if (current) {
      await manager.update(Secret, current.id, {
        ciphertext: input.ciphertext,
      });
      return input.currentRef;
    }
    return this.storeSecret(manager, tenantId, {
      kind: 'pi_password',
      ciphertext: input.ciphertext,
    });
  }

  private assertValidConfig(
    sourceType: SourceType,
    config: Record<string, unknown>,
  ): void {
    assertNoSecrets(config);
    const problems = this.adapters.find(sourceType)?.validateConfig(config);
    if (problems && problems.length > 0) {
      throw new UnprocessableEntityException({
        code: 'INVALID_ENDPOINT_CONFIG',
        message: problems.join('; '),
      });
    }
  }

  private async replaceSecret(
    manager: EntityManager,
    connection: IntegrationConnection,
    secret: string,
  ): Promise<string> {
    const ciphertext = this.encryption.encrypt(secret);
    const currentId = connection.secretRef?.startsWith(SECRET_REF_PREFIX)
      ? connection.secretRef.slice(SECRET_REF_PREFIX.length)
      : null;
    if (currentId) {
      const updated = await manager.update(
        Secret,
        { id: currentId, tenantId: connection.tenantId },
        { ciphertext },
      );
      if (updated.affected) return connection.secretRef as string;
    }
    return this.storeSecret(manager, connection.tenantId, {
      kind: `${connection.sourceType}_secret`,
      ciphertext,
    });
  }

  private async storeSecret(
    manager: EntityManager,
    tenantId: string,
    secret: { kind: string; ciphertext: string },
  ): Promise<string> {
    const saved = await manager.save(
      manager.create(Secret, { tenantId, ...secret }),
    );
    return `${SECRET_REF_PREFIX}${saved.id}`;
  }
}

function assertNoSecrets(config: Record<string, unknown>): void {
  const offending = Object.keys(config).filter((key) =>
    SECRET_KEY_PATTERN.test(key),
  );
  if (offending.length === 0) return;
  throw new UnprocessableEntityException({
    code: 'SECRET_IN_CONFIG',
    message: `endpointConfig must not contain credentials (${offending.join(', ')}); send them as "secret"`,
  });
}

function piEndpoint(pi: PiConnectionSource): Record<string, unknown> {
  const endpoint: Record<string, unknown> = { piWebApiUrl: pi.piWebApiUrl };
  if (pi.username) endpoint.username = pi.username;
  if (pi.afDatabasePath) endpoint.afDatabasePath = pi.afDatabasePath;
  if (skipsTlsVerification(pi.connectionConfig))
    endpoint.allowInsecureTls = true;
  return endpoint;
}

/** The v1 opt-out of TLS verification (plan 0.4 proxy setting), carried into the mirror. */
function skipsTlsVerification(connectionConfig?: string | null): boolean {
  if (!connectionConfig) return false;
  try {
    const parsed: unknown = JSON.parse(connectionConfig);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as Record<string, unknown>).insecureSkipTlsVerify === true
    );
  } catch {
    return false;
  }
}

function sameMirror(
  existing: IntegrationConnection,
  fields: Pick<
    IntegrationConnection,
    'displayName' | 'endpointConfig' | 'secretRef' | 'isActive'
  >,
): boolean {
  return (
    existing.displayName === fields.displayName &&
    existing.secretRef === fields.secretRef &&
    existing.isActive === fields.isActive &&
    canonicalJson(existing.endpointConfig) ===
      canonicalJson(fields.endpointConfig)
  );
}
