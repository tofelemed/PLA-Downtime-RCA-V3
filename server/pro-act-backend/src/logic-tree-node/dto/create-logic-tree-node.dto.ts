import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateLogicTreeNodeDto {
  @ApiProperty()
  @IsUUID()
  rcaId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  question: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  answer?: string;

  @ApiProperty({ enum: ['Root', 'Why', 'How', 'Cause'] })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty()
  @IsBoolean()
  verified: boolean;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  evidenceIds: string[];

  @ApiProperty()
  position: any;
} 