import { PartialType } from '@nestjs/swagger';
import { CreateProductionPlanDto } from './create-production-plan.dto';

export class UpdateProductionPlanDto extends PartialType(CreateProductionPlanDto) {} 