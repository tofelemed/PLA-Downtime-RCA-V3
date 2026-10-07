import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomAttributeDefinition } from './custom-attribute-definition.entity';
import { CustomAttributeDefinitionController } from './custom-attribute-definition.controller';
import { CustomAttributeDefinitionService } from './custom-attribute-definition.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomAttributeDefinition])],
  controllers: [CustomAttributeDefinitionController],
  providers: [CustomAttributeDefinitionService],
  exports: [CustomAttributeDefinitionService],
})
export class CustomAttributeDefinitionModule {}

