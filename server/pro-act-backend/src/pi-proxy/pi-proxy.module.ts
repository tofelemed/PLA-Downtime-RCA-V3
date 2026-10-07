import { Module } from '@nestjs/common';
import { PIProxyController } from './pi-proxy.controller';

@Module({
  controllers: [PIProxyController],
})
export class PIProxyModule {}

