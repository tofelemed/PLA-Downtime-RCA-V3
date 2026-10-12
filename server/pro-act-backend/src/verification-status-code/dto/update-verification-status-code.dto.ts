import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CHECKLIST_ITEM_MAX_LENGTH,
  CHECKLIST_MAX_ITEMS,
} from './create-verification-status-code.dto';

export class UpdateVerificationStatusCodeDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    required: false,
    example: '#3B82F6',
    description: 'Hex colour of the checklist badge',
  })
  @IsHexColor()
  @MaxLength(50)
  @IsOptional()
  color?: string;

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Checklist items in display order (replaces the list)',
  })
  @IsArray()
  @ArrayMaxSize(CHECKLIST_MAX_ITEMS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(CHECKLIST_ITEM_MAX_LENGTH, { each: true })
  @IsOptional()
  items?: string[];
}