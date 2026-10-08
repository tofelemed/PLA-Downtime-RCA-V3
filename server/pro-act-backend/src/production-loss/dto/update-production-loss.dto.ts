import { PartialType } from '@nestjs/swagger';
import { CreateProductionLossDto } from './create-production-loss.dto';

/** All `production_losses` columns of the create DTO, optional (B13). */
export class UpdateProductionLossDto extends PartialType(
  CreateProductionLossDto,
) {}
