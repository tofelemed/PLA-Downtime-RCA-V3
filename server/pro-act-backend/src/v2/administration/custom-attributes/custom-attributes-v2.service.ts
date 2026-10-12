import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Brackets, DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { satisfiesRole } from '../../../auth/roles/role-model';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { CustomAttributeDefinition } from '../../../custom-attribute-definition/custom-attribute-definition.entity';
import { CustomAttributeValue } from '../../../custom-attribute-value/custom-attribute-value.entity';
import { listResponse, ListResponse } from '../../common/response';
import { ATTRIBUTE_WRITERS } from '../administration-roles';
import { expressionKeysetPage } from '../common/expression-keyset';
import { PlaceNamesService } from '../common/place-names.service';
import {
  AttributeDefinitionV2View,
  toAttributeView,
} from './attribute-definition-v2.view';
import {
  AttributeDefinitionsQueryDto,
  CreateAttributeDefinitionDto,
  UpdateAttributeDefinitionDto,
} from './custom-attributes-v2.dto';

type Definition = CustomAttributeDefinition;
const ORDER_KEY = 'COALESCE("d"."display_order", 0)';

const json = (value: unknown) =>
  value === undefined ? undefined : JSON.stringify(value);

/**
 * Custom attribute definitions on v2 (Admin panel → Custom attributes; master data reuses the screen).
 * A plant sees its own definitions plus those of its organization and the shared (global) ones, which
 * predate plant ownership. This is the one administration read that does not start with `scopedQuery`:
 * the shared rows have no tenant. New definitions always belong to the acting plant; the shared ones
 * change only by a super administrator. Deleting a definition deletes its values.
 */
@Injectable()
export class CustomAttributesV2Service {
  constructor(
    @InjectRepository(CustomAttributeDefinition)
    private readonly definitions: Repository<Definition>,
    private readonly places: PlaceNamesService,
    private readonly dataSource: DataSource,
  ) {}

  async list(
    context: RequestContext,
    query: AttributeDefinitionsQueryDto,
  ): Promise<ListResponse<AttributeDefinitionV2View>> {
    const tenantId = requireTenantId(context);
    const qb = await this.visible(context);
    if (query.entityType)
      qb.andWhere('d.entityType = :entityType', {
        entityType: query.entityType,
      });
    const page = await expressionKeysetPage(qb, {
      alias: 'd',
      expression: ORDER_KEY,
      cast: 'int',
      direction: 'ASC',
      cursor: query.cursor,
      limit: query.limit,
      valueOf: (definition) => definition.displayOrder ?? 0,
    });
    const items = page.items.map((d) =>
      toAttributeView(d, this.mayEdit(context, d)),
    );
    return listResponse(items, page.nextCursor, { tenantId });
  }

  async get(
    context: RequestContext,
    id: string,
  ): Promise<AttributeDefinitionV2View> {
    const definition = await this.find(context, id);
    return toAttributeView(definition, this.mayEdit(context, definition));
  }

  async create(
    context: RequestContext,
    body: CreateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionV2View> {
    const tenantId = requireTenantId(context);
    await this.assertNameFree(tenantId, body.entityType, body.name);
    const definition = await this.definitions.save(
      this.definitions.create({
        id: randomUUID(),
        tenantId,
        organizationId:
          (await this.places.organizationOf(tenantId)) ?? undefined,
        entityType: body.entityType,
        attributeName: body.name,
        displayName: body.displayName.trim(),
        description: body.description,
        dataType: body.dataType,
        isRequired: body.isRequired ?? false,
        defaultValue: body.defaultValue,
        validationRules: json(body.validationRules),
        selectOptions: json(body.selectOptions),
        displayOrder:
          body.displayOrder ??
          (await this.nextOrder(tenantId, body.entityType)),
        isActive: body.isActive ?? true,
        createdBy: context.userId ?? undefined,
      }),
    );
    return this.get(context, definition.id);
  }

  async update(
    context: RequestContext,
    id: string,
    body: UpdateAttributeDefinitionDto,
  ): Promise<AttributeDefinitionV2View> {
    const definition = await this.editable(context, id);
    const { validationRules, selectOptions, displayName, ...rest } = body;
    await this.definitions.save({
      ...definition,
      ...rest,
      ...(displayName !== undefined ? { displayName: displayName.trim() } : {}),
      ...(validationRules !== undefined
        ? { validationRules: json(validationRules) }
        : {}),
      ...(selectOptions !== undefined
        ? { selectOptions: json(selectOptions) }
        : {}),
    });
    return this.get(context, id);
  }

  async remove(context: RequestContext, id: string): Promise<void> {
    const definition = await this.editable(context, id);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CustomAttributeValue, {
        attributeDefinitionId: definition.id,
      });
      await manager.delete(CustomAttributeDefinition, { id: definition.id });
    });
  }

  /** Writers change the plant's own definitions; shared ones only a super administrator. */
  private mayEdit(context: RequestContext, definition: Definition): boolean {
    const writer = ATTRIBUTE_WRITERS.some((role) =>
      satisfiesRole(context.roles, role),
    );
    if (!writer) return false;
    return context.isSuperAdmin || definition.tenantId === context.tenantId;
  }

  private async editable(
    context: RequestContext,
    id: string,
  ): Promise<Definition> {
    const definition = await this.find(context, id);
    if (!this.mayEdit(context, definition)) {
      throw new ForbiddenException({
        code: 'ATTRIBUTE_NOT_EDITABLE',
        message:
          'This attribute is shared by other plants; only a super administrator can change it',
      });
    }
    return definition;
  }

  private async find(context: RequestContext, id: string): Promise<Definition> {
    const definition = await (await this.visible(context))
      .andWhere('d.id = :id', { id })
      .getOne();
    if (!definition)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
    return definition;
  }

  private async visible(
    context: RequestContext,
  ): Promise<SelectQueryBuilder<Definition>> {
    const tenantId = requireTenantId(context);
    const organizationId = await this.places.organizationOf(tenantId);
    return this.definitions.createQueryBuilder('d').where(
      new Brackets((inner) =>
        inner
          .where('d.tenantId = :tenantId', { tenantId })
          .orWhere(
            '(d.tenantId IS NULL AND (d.organizationId IS NULL OR d.organizationId = :orgId))',
            {
              orgId: organizationId ?? '',
            },
          ),
      ),
    );
  }

  private async assertNameFree(
    tenantId: string,
    entityType: string,
    name: string,
  ): Promise<void> {
    const taken = await this.definitions.count({
      where: { tenantId, entityType, attributeName: name },
    });
    if (taken > 0) {
      throw new ConflictException({
        code: 'ATTRIBUTE_EXISTS',
        message: 'An attribute with this name already exists for this level',
      });
    }
  }

  private async nextOrder(
    tenantId: string,
    entityType: string,
  ): Promise<number> {
    const row = await this.definitions
      .createQueryBuilder('d')
      .select('COALESCE(MAX(d.displayOrder), -1) + 1', 'next')
      .where('d.tenantId = :tenantId', { tenantId })
      .andWhere('d.entityType = :entityType', { entityType })
      .getRawOne<{ next: number }>();
    return Number(row?.next ?? 0);
  }
}
