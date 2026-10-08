import { PartialType } from '@nestjs/swagger';
import { CreateReconcileFormDto } from './create-reconcile-form.dto';

/** Every form column of the create DTO, all optional (B3). */
export class UpdateReconcileFormDto extends PartialType(
  CreateReconcileFormDto,
) {}
