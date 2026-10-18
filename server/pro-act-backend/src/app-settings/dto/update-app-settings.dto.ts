import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty } from 'class-validator';

export class UpdateAppSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNotEmpty()
  value?: any;
}
