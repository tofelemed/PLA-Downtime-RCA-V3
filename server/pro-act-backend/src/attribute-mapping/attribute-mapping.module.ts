import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PIMapping } from '../pi-mapping/pi-mapping.entity';
import { AttributeMappingVersion } from './attribute-mapping-version.entity';
import { AttributeMappingService } from './attribute-mapping.service';

/** Typed, versioned attribute mapping over the shared field catalog (plan 1.3, ING04). */
@Module({
  imports: [TypeOrmModule.forFeature([AttributeMappingVersion, PIMapping])],
  providers: [AttributeMappingService],
  exports: [AttributeMappingService],
})
export class AttributeMappingModule {}
