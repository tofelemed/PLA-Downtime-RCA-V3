import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/** What a master-data record is called in messages. */
export type RecordKind =
  | 'unit'
  | 'asset'
  | 'product'
  | 'RCA template'
  | 'RCA cause'
  | 'verification checklist';

const UNIQUE_VIOLATION = '23505';

/** 409 `MASTER_DATA_CODE_EXISTS` on the `code` field (codes are unique per plant; products per organisation). */
export function codeTaken(kind: RecordKind, code: string): ConflictException {
  const message = `The ${kind} code "${code}" is already used. Choose another code.`;
  return new ConflictException({
    code: 'MASTER_DATA_CODE_EXISTS',
    message,
    fieldErrors: [{ field: 'code', message }],
  });
}

/** 404 for an id outside the caller's tenant or scope (no existence leak). */
export function recordNotFound(kind: RecordKind): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: `The ${kind} was not found`,
  });
}

/** 409 `MASTER_DATA_RETIRED`: a retired record cannot be changed (restore it first). */
export function recordRetired(kind: RecordKind): ConflictException {
  return new ConflictException({
    code: 'MASTER_DATA_RETIRED',
    message: `The ${kind} is retired; restore it before changing it`,
  });
}

/** 409 `MASTER_DATA_NOT_RETIRED` on a restore of an active record. */
export function recordNotRetired(kind: RecordKind): ConflictException {
  return new ConflictException({
    code: 'MASTER_DATA_NOT_RETIRED',
    message: `The ${kind} is not retired`,
  });
}

/** 409 `UNIT_HAS_ACTIVE_ASSETS`: retire or move the unit's assets first. */
export function unitHasActiveAssets(count: number): ConflictException {
  return new ConflictException({
    code: 'UNIT_HAS_ACTIVE_ASSETS',
    message: `The unit has ${count} active asset(s); retire or move them first`,
    details: { activeAssets: count },
  });
}

/** 409 `RCA_CAUSE_HAS_CHILDREN`: retire or move the sub-causes first. */
export function causeHasChildren(count: number): ConflictException {
  return new ConflictException({
    code: 'RCA_CAUSE_HAS_CHILDREN',
    message: `The cause has ${count} active sub-cause(s); retire or move them first`,
    details: { activeChildren: count },
  });
}

/** 422 `INVALID_REFERENCE` on one field (a unit, parent or checklist outside the tenant, or retired). */
export function invalidField(
  field: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}
