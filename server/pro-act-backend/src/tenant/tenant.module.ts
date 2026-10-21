import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { AuditLogCoreModule } from '../audit-log/audit-log-core.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AuditLogCoreModule],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}
