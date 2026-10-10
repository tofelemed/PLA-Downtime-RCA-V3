import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { RuleFieldError } from './grammar/rule-validator';

/** 422 `RULE_INVALID` with one field error per rejected part of the definition (NFR02). */
export function ruleInvalid(
  fieldErrors: RuleFieldError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'RULE_INVALID',
    message: fieldErrors.map((error) => `${error.field} ${error.message}`),
    fieldErrors,
  });
}

/** 422 `INVALID_REFERENCE`: an id in the definition that is not a record of the tenant. */
export function ruleReferenceInvalid(
  field: string,
  what: string,
): UnprocessableEntityException {
  const message = `is not a ${what} of the tenant`;
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [`${field} ${message}`],
    fieldErrors: [{ field, message }],
  });
}

export function ruleNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'Rule not found',
  });
}

export function ruleExists(name: string): ConflictException {
  return new ConflictException({
    code: 'RULE_EXISTS',
    message: `A rule named "${name}" already exists in the tenant`,
  });
}

export function ruleRetired(): ConflictException {
  return new ConflictException({
    code: 'RULE_RETIRED',
    message: 'The rule is retired',
  });
}

export function noDraft(): ConflictException {
  return new ConflictException({
    code: 'NO_DRAFT',
    message: 'The rule has no pending draft to activate',
  });
}

export function versionNotFound(version: number): UnprocessableEntityException {
  const message = `version ${version} does not exist for this rule`;
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field: 'toVersion', message }],
  });
}

export function rollbackToCurrent(): ConflictException {
  return new ConflictException({
    code: 'INVALID_TRANSITION',
    message: 'The requested version is already in force',
  });
}

/** 403: the author of a draft cannot activate it (same separation of duties as policy approval). */
export function separationOfDuties(): ForbiddenException {
  return new ForbiddenException({
    code: 'SEPARATION_OF_DUTIES',
    message: 'A rule draft is activated by someone other than its author',
  });
}
