import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString, MaxLength } from 'class-validator';

export class CreatePISyncJobDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({ description: 'Job name', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  jobName?: string;

  @ApiProperty({ description: 'Job type', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  jobType?: string;

  @ApiProperty({ description: 'Schedule (cron)', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  schedule?: string;

  @ApiProperty({ description: 'Last run time', required: false })
  @IsOptional()
  @IsDateString()
  lastRunTime?: string;

  @ApiProperty({ description: 'Next run time', required: false })
  @IsOptional()
  @IsDateString()
  nextRunTime?: string;

  @ApiProperty({ description: 'Status', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiProperty({ description: 'Error message', required: false })
  @IsOptional()
  @IsString()
  errorMessage?: string;

  @ApiProperty({ description: 'Job config (JSON)', required: false })
  @IsOptional()
  @IsString()
  jobConfig?: string;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

