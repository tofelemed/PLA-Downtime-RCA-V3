import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { UpsertStreamDataSourceDto } from './upsert-stream-data-source.dto';
import { UpsertStreamDataSinkDto } from './upsert-stream-data-sink.dto';
import { UpsertStreamProcessorDto } from './upsert-stream-processor.dto';
import { UpsertStreamMetricDto } from './upsert-stream-metric.dto';
import { UpsertStreamAlertDto } from './upsert-stream-alert.dto';
import { UpsertStreamConnectionConfigDto } from './upsert-stream-connection-config.dto';

export class ImportStreamingPayloadDto {
  @ApiProperty({ type: [UpsertStreamDataSourceDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamDataSourceDto)
  dataSources?: UpsertStreamDataSourceDto[];

  @ApiProperty({ type: [UpsertStreamDataSinkDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamDataSinkDto)
  dataSinks?: UpsertStreamDataSinkDto[];

  @ApiProperty({ type: [UpsertStreamProcessorDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamProcessorDto)
  streamProcessors?: UpsertStreamProcessorDto[];

  @ApiProperty({ type: [UpsertStreamMetricDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamMetricDto)
  streamMetrics?: UpsertStreamMetricDto[];

  @ApiProperty({ type: [UpsertStreamAlertDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamAlertDto)
  streamAlerts?: UpsertStreamAlertDto[];

  @ApiProperty({ type: [UpsertStreamConnectionConfigDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertStreamConnectionConfigDto)
  connectionConfigs?: UpsertStreamConnectionConfigDto[];
}


