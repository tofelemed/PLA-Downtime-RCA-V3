import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { EntityManager } from 'typeorm';
import { RequestContext } from '../../common/context/request-context';
import { Product } from '../../product/product.entity';
import {
  codeTaken,
  isUniqueViolation,
  recordNotRetired,
  recordRetired,
} from '../master-data/common/master-data-errors';
import {
  organizationOfTenant,
  writerStamp,
} from '../master-data/common/master-data-writer';
import {
  definedOnly,
  keepUnlessGiven,
  updateWithRevision,
} from '../master-data/common/revisioned-update';
import { ProductV2ChangeDto, ProductV2CreateDto } from './product-v2.dto';
import { ProductV2View, toProductView } from './product-v2.view';
import { ProductsV2Service } from './products-v2.service';

interface CodeScope {
  tenantId: string;
  organizationId: string;
}

/**
 * Product writes of the v2 master-data screens. A product belongs to the organisation (shared by its
 * plants, the v1 model) unless created for the acting plant only. Codes are unique among the products a
 * plant of the organisation can see (case-insensitive); retire sets `is_active = false`.
 */
@Injectable()
export class ProductsV2CommandsService {
  constructor(
    @InjectEntityManager() private readonly manager: EntityManager,
    private readonly reads: ProductsV2Service,
  ) {}

  async create(
    context: RequestContext,
    input: ProductV2CreateDto,
  ): Promise<ProductV2View> {
    const stamp = writerStamp(context);
    try {
      return await this.manager.transaction(async (manager) => {
        const organizationId = await organizationOfTenant(
          manager,
          stamp.tenantId,
        );
        await assertCodeFree(
          manager,
          { tenantId: stamp.tenantId, organizationId },
          input.code,
        );
        const id = randomUUID();
        await manager.getRepository(Product).insert({
          id,
          tenantId: input.availability === 'plant' ? stamp.tenantId : undefined,
          organizationId,
          code: input.code,
          name: input.name,
          isActive: true,
          ...detailsOf(input),
        });
        return toProductView(await this.reads.find(context, id, manager), true);
      });
    } catch (error) {
      throw isUniqueViolation(error) ? codeTaken('product', input.code) : error;
    }
  }

  async change(
    context: RequestContext,
    target: { id: string; expectedVersion: number },
    input: ProductV2ChangeDto,
  ): Promise<ProductV2View> {
    const stamp = writerStamp(context);
    const code = keepUnlessGiven(input.code);
    try {
      return await this.manager.transaction(async (manager) => {
        const product = await this.reads.find(context, target.id, manager);
        if (!product.isActive) throw recordRetired('product');
        if (code !== undefined && code !== product.code) {
          const organizationId = await organizationOfTenant(
            manager,
            stamp.tenantId,
          );
          await assertCodeFree(
            manager,
            { tenantId: stamp.tenantId, organizationId },
            code,
            product.id,
          );
        }
        await updateWithRevision(manager, Product, target, {
          ...definedOnly({ code, name: keepUnlessGiven(input.name) }),
          ...detailsOf(input),
        });
        return toProductView(
          await this.reads.find(context, product.id, manager),
          true,
        );
      });
    } catch (error) {
      throw isUniqueViolation(error) ? codeTaken('product', code ?? '') : error;
    }
  }

  async retire(context: RequestContext, id: string): Promise<ProductV2View> {
    return this.setActive(context, id, false);
  }

  async restore(context: RequestContext, id: string): Promise<ProductV2View> {
    return this.setActive(context, id, true);
  }

  private async setActive(
    context: RequestContext,
    id: string,
    active: boolean,
  ): Promise<ProductV2View> {
    writerStamp(context);
    return this.manager.transaction(async (manager) => {
      const product = await this.reads.find(context, id, manager);
      if (product.isActive === active) {
        throw active ? recordNotRetired('product') : recordRetired('product');
      }
      await manager
        .getRepository(Product)
        .update(product.id, { isActive: active });
      return toProductView(
        await this.reads.find(context, product.id, manager),
        true,
      );
    });
  }
}

function detailsOf(
  input: ProductV2CreateDto | ProductV2ChangeDto,
): Partial<Product> {
  const cost = input.legacyStandardCost;
  return definedOnly({
    unitOfMeasure: input.uom,
    description: input.description,
    standardCost:
      cost === undefined ? undefined : cost === null ? null : Number(cost),
  }) as Partial<Product>;
}

/**
 * 409 MASTER_DATA_CODE_EXISTS when a product the plant or its organisation can see has the code: the
 * plant's own products, the organisation's shared products and those of the organisation's other plants.
 */
async function assertCodeFree(
  manager: EntityManager,
  scope: CodeScope,
  code: string,
  exceptId?: string,
): Promise<void> {
  const rows = await manager.query<unknown[]>(
    `SELECT 1 FROM "products" p
      WHERE lower(p."code") = lower($1) AND p."id" <> $2
        AND (p."tenant_id" = $3
          OR (p."tenant_id" IS NULL AND p."organization_id" = $4)
          OR p."tenant_id" IN (SELECT t."id"::text FROM "tenants" t WHERE t."organization_id" = $4::uuid))
      LIMIT 1`,
    [
      code,
      exceptId ?? '00000000-0000-0000-0000-000000000000',
      scope.tenantId,
      scope.organizationId,
    ],
  );
  if (rows.length > 0) throw codeTaken('product', code);
}
