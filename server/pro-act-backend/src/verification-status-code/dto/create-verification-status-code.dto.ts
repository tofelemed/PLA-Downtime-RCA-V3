import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray } from 'class-validator';

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

  // Note: Database schema doesn't have 'color' or 'items'
  // @ApiProperty()
  // @IsString()
  // @IsNotEmpty()
  // color: string;

  // @ApiProperty({ required: false, type: [String] })
  // @IsArray()
  // @IsString({ each: true })
  // @IsOptional()
  // items?: string[];

  @ApiProperty({ required: false })
  @IsUUID()
  @IsOptional()
  tenantId?: string;
} 