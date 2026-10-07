import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AfBinding } from './af-binding.entity';
import { AfBindingController } from './af-binding.controller';
import { AfBindingService } from './af-binding.service';

@Module({
  imports: [TypeOrmModule.forFeature([AfBinding])],
  controllers: [AfBindingController],
  providers: [AfBindingService],
  exports: [AfBindingService],
})
export class AfBindingModule {}

