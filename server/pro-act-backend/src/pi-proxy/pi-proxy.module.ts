import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIConnection } from '../pi-connection/pi-connection.entity';
import { PIProxyController } from './pi-proxy.controller';
import { PIProxyService } from './pi-proxy.service';

@Module({
  imports: [TypeOrmModule.forFeature([PIConnection])],
  controllers: [PIProxyController],
  providers: [PIProxyService],
})
export class PIProxyModule {}
