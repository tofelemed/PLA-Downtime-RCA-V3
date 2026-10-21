import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditLogCoreModule } from './audit-log-core.module';
import { AuditLogController } from './audit-log.controller';
import { AuditAutoLogInterceptor } from './audit-auto-log.interceptor';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [AuditLogCoreModule],
  providers: [
    AuditAutoLogInterceptor,
    RolesGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditAutoLogInterceptor,
    },
  ],
  controllers: [AuditLogController],
  exports: [AuditLogCoreModule],
})
export class AuditLogModule {}
