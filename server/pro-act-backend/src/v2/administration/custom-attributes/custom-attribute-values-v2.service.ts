import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../../../asset/asset.entity';
import {
  RequestContext,
  requireTenantId,
} from '../../../common/context/request-context';
import { CustomAttributeValue } from '../../../custom-attribute-value/custom-attribute-value.entity';
import { Unit } from '../../../unit/unit.entity';
import {
  AttributeValuesQueryDto,
  AttributeValueV2View,
  SetAttributeValueDto,
} from './custom-attribute-values-v2.dto';
import { CustomAttributesV2Service } from './custom-attributes-v2.service';

const toView = (value: CustomAttributeValue): AttributeValueV2View => ({
  attributeDefinitionId: value.attributeDefinitionId,
  value: value.value ?? '',
  updatedAt: value.updatedAt.toISOString(),
});

/**
 * Custom attribute values of the acting plant's units and assets (v2; replaces the v1 routes that took
 * the tenant from the query). The record must belong to the plant (404 otherwise, no existence leak) and
 * the definition must apply in the plant and to the record's type.
 */
@Injectable()
export class CustomAttributeValuesV2Service {
  constructor(
    @InjectRepository(CustomAttributeValue)
    private readonly values: Repository<CustomAttributeValue>,
    @InjectRepository(Unit) private readonly units: Repository<Unit>,
    @InjectRepository(Asset) private readonly assets: Repository<Asset>,
    private readonly definitions: CustomAttributesV2Service,
  ) {}

  async list(
    context: RequestContext,
    query: AttributeValuesQueryDto,
  ): Promise<AttributeValueV2View[]> {
    const tenantId = requireTenantId(context);
    await this.assertRecordOwned(tenantId, query);
    const rows = await this.values.find({
      where: {
        tenantId,
        entityType: query.entityType,
        entityId: query.entityId,
      },
      order: { createdAt: 'ASC' },
    });
    return rows.map(toView);
  }

  async set(
    context: RequestContext,
    body: SetAttributeValueDto,
  ): Promise<AttributeValueV2View> {
    const tenantId = requireTenantId(context);
    await this.assertRecordOwned(tenantId, body);
    const definition = await this.definitions.get(
      context,
      body.attributeDefinitionId,
    );
    if (definition.entityType !== body.entityType) {
      throw new UnprocessableEntityException({
        code: 'ATTRIBUTE_TYPE_MISMATCH',
        message: `This attribute is defined for ${definition.entityType}, not ${body.entityType}`,
      });
    }
    const key = {
      tenantId,
      entityType: body.entityType,
      entityId: body.entityId,
      attributeDefinitionId: body.attributeDefinitionId,
    };
    const existing = await this.values.findOne({ where: key });
    const saved = await this.values.save(
      existing
        ? { ...existing, value: body.value }
        : this.values.create({ ...key, value: body.value }),
    );
    return toView(saved);
  }

  private async assertRecordOwned(
    tenantId: string,
    record: AttributeValuesQueryDto,
  ): Promise<void> {
    const where = { id: record.entityId, tenantId };
    const found =
      record.entityType === 'Unit'
        ? await this.units.exists({ where })
        : await this.assets.exists({ where });
    if (!found)
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Not found' });
  }
}
