import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { AuditLogController } from './audit-log.controller';
import { AuditAutoLogInterceptor } from './audit-auto-log.interceptor';
import { RolesGuard } from '../auth/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [
    AuditLogService,
    AuditAutoLogInterceptor,
    RolesGuard,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditAutoLogInterceptor,
    },
  ],
  controllers: [AuditLogController],
  exports: [AuditLogService],
})
export class AuditLogModule {}
