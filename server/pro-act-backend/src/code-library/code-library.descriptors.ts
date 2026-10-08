import { EntityTarget, ObjectLiteral } from 'typeorm';
import {
  OeeComponent,
  ScheduleClass,
} from '../domain/events/event-classification';
import { ImpactCode } from '../impact-code/impact-code.entity';
import { OEECode } from '../oee-code/oee-code.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { CodeLibraryKind, FailureGroupKind } from './code-library-kind';
import { FailureCodeGroup } from './failure-code-group.entity';
import { LossCategoryDef } from './loss-category-def.entity';

/** Library-specific fields a v2 write may carry (each library allows a subset). */
export interface CodeExtras {
  category?: string | null;
  groupKind?: FailureGroupKind;
  reportOrder?: number;
  defaultOeeComponent?: OeeComponent | null;
  defaultScheduleClass?: ScheduleClass | null;
  defaultImpactCodeId?: string | null;
  costPerHour?: string | number | null;
}

/** The columns every code library shares (legacy tables and the new ones alike). */
export interface CodeRow extends ObjectLiteral, CodeExtras {
  id: string;
  tenantId?: string | null;
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  path?: string | null;
  level?: number;
  version: number;
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  isActive: boolean;
}

export interface CodeLibraryDescriptor {
  kind: CodeLibraryKind;
  entity: EntityTarget<CodeRow>;
  hierarchical: boolean;
  extraFields: ReadonlyArray<keyof CodeExtras>;
  /** `production_events` column referencing this library (retire reference counts) */
  eventColumn: string | null;
}

export const CODE_LIBRARY_DESCRIPTORS: Readonly<
  Record<CodeLibraryKind, CodeLibraryDescriptor>
> = {
  reason: {
    kind: 'reason',
    entity: ReasonCode,
    hierarchical: true,
    extraFields: [
      'category',
      'defaultOeeComponent',
      'defaultScheduleClass',
      'defaultImpactCodeId',
    ],
    eventColumn: 'reason_code_id',
  },
  impact: {
    kind: 'impact',
    entity: ImpactCode,
    hierarchical: false,
    extraFields: ['category', 'costPerHour'],
    eventColumn: 'impact_code_id',
  },
  oee: {
    kind: 'oee',
    entity: OEECode,
    hierarchical: false,
    extraFields: ['category'],
    eventColumn: 'oee_code_id',
  },
  failure: {
    kind: 'failure',
    entity: FailureCodeGroup,
    hierarchical: true,
    extraFields: ['groupKind'],
    eventColumn: null,
  },
  loss_category: {
    kind: 'loss_category',
    entity: LossCategoryDef,
    hierarchical: true,
    extraFields: ['reportOrder'],
    eventColumn: null,
  },
};
