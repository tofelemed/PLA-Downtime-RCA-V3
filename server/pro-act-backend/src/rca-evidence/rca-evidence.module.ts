import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAEvidence } from './rca-evidence.entity';
import { RCAEvidenceService } from './rca-evidence.service';
import { RCAEvidenceController } from './rca-evidence.controller';
import { FileUploadController } from './file-upload.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RCAEvidence])],
  providers: [RCAEvidenceService],
  controllers: [RCAEvidenceController, FileUploadController],
  exports: [RCAEvidenceService],
})
export class RCAEvidenceModule {} 