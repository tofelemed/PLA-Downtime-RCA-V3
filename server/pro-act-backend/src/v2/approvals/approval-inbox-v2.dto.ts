import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class ApprovalInboxQueryDto {
  @ApiPropertyOptional({ maxLength: 1024 })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  cursor?: string;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
  @ApiPropertyOptional({
    description: 'Exact workflow kind returned by an inbox row',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  kind?: string;
}
export class ApprovalActionView {
  @ApiProperty({ enum: ['approve', 'retire', 'reject', 'return', 'activate'] })
  action: string;
  @ApiProperty({ nullable: true, type: String }) disabledReason: string | null;
}
export class ApprovalItemView {
  @ApiProperty() id: string;
  @ApiProperty() kind: string;
  @ApiProperty() kindLabel: string;
  @ApiProperty() title: string;
  @ApiProperty() summary: string;
  @ApiProperty() state: string;
  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true, type: String }) unitId: string | null;
  @ApiProperty({ nullable: true, type: String }) unitName: string | null;
  @ApiProperty({ nullable: true, type: String }) authorId: string | null;
  @ApiProperty({ nullable: true, type: String }) authorName: string | null;
  @ApiProperty({ type: [String] }) requiredRoles: string[];
  @ApiProperty() reviewHref: string;
  @ApiProperty({ nullable: true, type: String }) resource: string | null;
  @ApiProperty() commandId: string;
  @ApiProperty({ nullable: true, type: Number }) version: number | null;
  @ApiProperty() rowVersion: number;
  @ApiProperty() supersede: boolean;
  @ApiProperty({ type: [ApprovalActionView] }) actions: ApprovalActionView[];
}
export class ApprovalInboxView {
  @ApiProperty({ type: [ApprovalItemView] }) items: ApprovalItemView[];
  @ApiProperty({ nullable: true, type: String }) nextCursor: string | null;
  @ApiProperty() asOf: string;
  @ApiProperty({ type: Object }) scope: { tenantId: string };
}
