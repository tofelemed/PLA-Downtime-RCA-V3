import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class BulkDeleteDto {
  @ApiProperty({ type: [String], description: 'Array of entity IDs to delete' })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];
}

export class BulkUpdateDto<T> {
  @ApiProperty({ type: [String], description: 'Array of entity IDs to update' })
  @IsArray()
  @IsUUID('4', { each: true })
  ids: string[];

  @ApiProperty({ description: 'Data to update for all entities' })
  data: Partial<T>;
}

export class BulkCreateDto<T> {
  @ApiProperty({ type: [Object], description: 'Array of entities to create' })
  @IsArray()
  data: T[];
}

export class BulkOperationResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;

  @ApiProperty()
  affectedCount: number;

  @ApiProperty({ required: false })
  errors?: string[];

  @ApiProperty({ required: false })
  failedIds?: string[];
}
