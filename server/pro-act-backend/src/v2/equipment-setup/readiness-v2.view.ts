import { ApiProperty } from '@nestjs/swagger';

export const READINESS_STATUSES = [
  'ready',
  'missing',
  'needs_attention',
  'not_checked',
  'optional',
] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];
export class ReadinessCheckView {
  @ApiProperty() id: string;
  @ApiProperty() stepId: string;
  @ApiProperty() label: string;
  @ApiProperty({ enum: READINESS_STATUSES }) status: ReadinessStatus;
  @ApiProperty() detail: string;
  @ApiProperty({
    type: Number,
    nullable: true,
    description:
      'Observed/configured share of the selected window, 0–1; null when not evaluated.',
  })
  coverage: number | null;
}
export class EquipmentReadinessView {
  @ApiProperty({ format: 'date-time' }) asOf: string;
  @ApiProperty({ format: 'uuid' }) tenantId: string;
  @ApiProperty({ format: 'uuid' }) unitId: string;
  @ApiProperty({ type: String, nullable: true }) productId: string | null;
  @ApiProperty() operatingMode: string;
  @ApiProperty({ format: 'date-time' }) from: string;
  @ApiProperty({ format: 'date-time' }) to: string;
  @ApiProperty({ type: [ReadinessCheckView] }) checks: ReadinessCheckView[];
}
