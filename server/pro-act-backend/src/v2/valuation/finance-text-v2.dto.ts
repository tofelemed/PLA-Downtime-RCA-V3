import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Body of PATCH /fx-rates/:id/source: the corrected description of the rate's source. */
export class FxSourceCorrectionDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  source: string;
}

/** Body of PATCH /demand-statuses/:id/evidence: the corrected evidence text. */
export class DemandEvidenceCorrectionDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  evidence: string;
}

/** Body of PATCH /valuation-policies/:id/text: corrected notes and / or backdate reason. */
export class PolicyTextCorrectionDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  backdateReason?: string;
}
