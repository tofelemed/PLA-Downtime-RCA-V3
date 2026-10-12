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

/** Limits of a checklist (the settings form edits an ordered list of item labels). */
export const CHECKLIST_MAX_ITEMS = 200;
export const CHECKLIST_ITEM_MAX_LENGTH = 500;

export class CreateVerificationStatusCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @ApiProperty({
    required: false,
    type: [String],
    description: 'Checklist items in display order',
  })
  @IsArray()
  @ArrayMaxSize(CHECKLIST_MAX_ITEMS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(CHECKLIST_ITEM_MAX_LENGTH, { each: true })
  @IsOptional()
  items?: string[];

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 