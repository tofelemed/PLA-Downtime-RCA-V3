import { ApiProperty } from '@nestjs/swagger';

export class CreateRCAEvidenceDto {
  @ApiProperty()
  rcaId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty({ enum: ['Photo', 'Document', 'Time Series', 'Note', 'Video'] })
  type: string;

  @ApiProperty({ required: false })
  fileName?: string;

  @ApiProperty({ required: false })
  filePath?: string;

  @ApiProperty()
  collectedBy: string;

  @ApiProperty()
  collectedAt: Date;

  @ApiProperty({ required: false, type: [String] })
  nodeIds?: string[];

  @ApiProperty({ required: false, type: 'string', format: 'binary' })
  fileBlob?: any;

  @ApiProperty({ required: false })
  category?: string;

  @ApiProperty({ required: false })
  location?: string;

  @ApiProperty({ required: false })
  timestamp?: Date;

  @ApiProperty({ required: false })
  relatedAssetId?: string;

  @ApiProperty({ required: false })
  severity?: string;

  @ApiProperty({ required: false, type: [String] })
  tags?: string[];

  @ApiProperty({ required: false })
  verified?: boolean;

  @ApiProperty({ required: false })
  fiveP?: string;

  @ApiProperty({ required: false })
  task?: string;

  @ApiProperty({ required: false })
  dueDate?: Date;

  @ApiProperty({ required: false })
  status?: string;

  @ApiProperty({ required: false, type: [Object] })
  attachments?: any[];
} 