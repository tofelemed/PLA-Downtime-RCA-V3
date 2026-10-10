import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getRequestContext } from '../../common/context/request-context';
import { rlsTenantIds, sessionBindingSql } from './rls-tenant-ids';

type Release = (error?: unknown) => void;
interface PgClient {
  query(sql: string): Promise<unknown>;
}
interface ConnectionSource {
  obtainMasterConnection(): Promise<[PgClient, Release]>;
}

const INSTALLED = Symbol('tenantSessionBinding');

/**
 * Binds every pooled connection to the caller before TypeORM uses it (plan 3.11 step 2): the driver's
 * connection checkout runs, in the async context of the query, `SET ROLE proact_rls_user` + the caller's
 * tenants for a signed-in non-SuperAdmin request, `RESET ROLE` + '' otherwise (one round trip), so the
 * row-level-security policies apply to exactly that request. Returns false when already installed.
 */
export function installTenantSessionBinding(dataSource: DataSource): boolean {
  const driver = dataSource.driver as unknown as ConnectionSource &
    Record<symbol, boolean>;
  if (driver[INSTALLED]) return false;
  const obtain = driver.obtainMasterConnection.bind(
    driver,
  ) as ConnectionSource['obtainMasterConnection'];
  driver.obtainMasterConnection = async () => {
    const binding = sessionBindingSql(rlsTenantIds(getRequestContext()));
    const [connection, release] = await obtain();
    try {
      await connection.query(binding);
    } catch (error) {
      release(error);
      throw error;
    }
    return [connection, release];
  };
  driver[INSTALLED] = true;
  return true;
}

/**
 * Installs the binding at boot — **on by default** (owner decision 2026-10-10); `DB_RLS_TENANT_BINDING=false`
 * turns it off (diagnosis only). It costs one round trip per connection checkout. The login role must be a
 * superuser or a member of `proact_rls_user`.
 */
@Injectable()
export class TenantSessionBinding implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantSessionBinding.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap(): void {
    if (process.env.DB_RLS_TENANT_BINDING === 'false') return;
    if (installTenantSessionBinding(this.dataSource)) {
      this.logger.log('Row-level security tenant binding is on');
    }
  }
}
