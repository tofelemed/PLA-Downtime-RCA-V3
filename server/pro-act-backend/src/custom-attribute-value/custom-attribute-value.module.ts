import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomAttributeValue } from './custom-attribute-value.entity';
import { CustomAttributeValueController } from './custom-attribute-value.controller';
import { CustomAttributeValueService } from './custom-attribute-value.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomAttributeValue])],
  controllers: [CustomAttributeValueController],
  providers: [CustomAttributeValueService],
  exports: [CustomAttributeValueService],
})
export class CustomAttributeValueModule {}

