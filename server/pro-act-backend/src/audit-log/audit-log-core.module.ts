import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';

/**
 * The audit log writer alone, for services that record their own changes (`recordChange`). Importing it
 * does not install the global auto-audit interceptor; `AuditLogModule` does that.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogCoreModule {}
