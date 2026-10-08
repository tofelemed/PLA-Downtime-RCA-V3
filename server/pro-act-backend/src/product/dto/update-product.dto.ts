import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

/** Same fields as the create DTO (incl. tenantId, unitId, organizationId, isActive), all optional. */
export class UpdateProductDto extends PartialType(CreateProductDto) {}
