import { UnitMaterialization } from '../../calendar/calendar-materializer.service';
import { CrewRotation } from '../../calendar/entities/crew-rotation.entity';
import { Crew } from '../../calendar/entities/crew.entity';
import { RotationPattern } from '../../domain/calendar/crew-rotation';

export interface CrewV2View {
  id: string;
  siteId: string;
  name: string;
  rowVersion: number;
  createdAt: string;
}

export interface CrewRotationV2View {
  id: string;
  crewId: string;
  pattern: RotationPattern;
  effectiveFrom: string;
  effectiveTo: string | null;
  rowVersion: number;
  createdAt: string;
}

/** A new rotation and the future instances re-assigned because of it. */
export interface CrewRotationCreatedV2View {
  rotation: CrewRotationV2View;
  materialization: UnitMaterialization[];
}

export function toCrewView(crew: Crew): CrewV2View {
  return {
    id: crew.id,
    siteId: crew.siteId,
    name: crew.name,
    rowVersion: crew.rowVersion,
    createdAt: crew.createdAt.toISOString(),
  };
}

export function toRotationView(rotation: CrewRotation): CrewRotationV2View {
  return {
    id: rotation.id,
    crewId: rotation.crewId,
    pattern: rotation.pattern,
    effectiveFrom: rotation.effectiveFrom,
    effectiveTo: rotation.effectiveTo,
    rowVersion: rotation.rowVersion,
    createdAt: rotation.createdAt.toISOString(),
  };
}
