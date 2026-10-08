import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CrewRotationInput } from '../domain/calendar/crew-rotation';
import { CrewRotation } from './entities/crew-rotation.entity';
import { Site } from './entities/site.entity';

/** Rotations of every crew of a site, in the generator's shape (assignment of crews to instances). */
@Injectable()
export class CrewRotationsLoader {
  constructor(
    @InjectRepository(CrewRotation)
    private readonly rotations: Repository<CrewRotation>,
  ) {}

  async forSite(
    site: Site,
    manager: EntityManager = this.rotations.manager,
  ): Promise<CrewRotationInput[]> {
    const rows = await manager
      .createQueryBuilder(CrewRotation, 'r')
      .innerJoin('r.crew', 'c')
      .where('r.tenantId = :tenantId AND c.siteId = :siteId', {
        tenantId: site.tenantId,
        siteId: site.id,
      })
      .orderBy('r.createdAt', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getMany();
    return rows.map((row) => ({
      crewId: row.crewId,
      pattern: row.pattern,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
    }));
  }
}
