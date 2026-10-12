import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Organization } from '../../../organization/organization.entity';
import { Tenant } from '../../../tenant/tenant.entity';

interface Placed {
  tenantId?: string | null;
  organizationId?: string | null;
}

/** Plant and organization names for administration views (one query each, never per row). */
@Injectable()
export class PlaceNamesService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(Organization)
    private readonly organizations: Repository<Organization>,
  ) {}

  /** Organization of a plant, or null when the plant does not exist. */
  async organizationOf(tenantId: string): Promise<string | null> {
    const tenant = await this.tenants.findOne({
      where: { id: tenantId },
      select: { id: true, organizationId: true },
    });
    return tenant?.organizationId ?? null;
  }

  async tenantNames(ids: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.tenants.find({
      where: { id: In(unique) },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  async organizationNames(
    ids: readonly string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.organizations.find({
      where: { id: In(unique) },
      select: { id: true, name: true },
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  /** Names of the plants and organizations a list of records is placed in. */
  async namesFor(records: readonly Placed[]): Promise<{
    tenants: Map<string, string>;
    organizations: Map<string, string>;
  }> {
    const tenantIds = records.flatMap((r) => (r.tenantId ? [r.tenantId] : []));
    const orgIds = records.flatMap((r) =>
      r.organizationId ? [r.organizationId] : [],
    );
    const [tenants, organizations] = await Promise.all([
      this.tenantNames(tenantIds),
      this.organizationNames(orgIds),
    ]);
    return { tenants, organizations };
  }
}
