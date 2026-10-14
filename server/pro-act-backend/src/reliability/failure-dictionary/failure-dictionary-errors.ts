import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DictionaryRowError } from '../../domain/reliability/failure-dictionary-import';
import { FieldProblem } from '../../domain/reliability/failure-dictionary';

export function entryNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'The failure dictionary entry was not found',
  });
}

/** 409: an open entry of the same kind, class and code exists. */
export function entryExists(code: string): ConflictException {
  const message = `The code "${code}" is already in the dictionary for this kind and class`;
  return new ConflictException({
    code: 'DICTIONARY_CODE_EXISTS',
    message,
    fieldErrors: [{ field: 'code', message }],
  });
}

/** 409: the entry has an end already (change or retire the entry in force instead). */
export function entryClosed(): ConflictException {
  return new ConflictException({
    code: 'DICTIONARY_ENTRY_CLOSED',
    message: 'The entry is no longer in force; change the current entry',
  });
}

/** 409: an equipment class still owns open maintainable items or failure modes. */
export function classInUse(count: number): ConflictException {
  return new ConflictException({
    code: 'DICTIONARY_CLASS_IN_USE',
    message: `The equipment class still has ${count} maintainable item(s) or failure mode(s); retire them first`,
    details: { openEntries: count },
  });
}

export function invalidDictionaryField(
  field: string,
  message: string,
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'INVALID_REFERENCE',
    message: [message],
    fieldErrors: [{ field, message }],
  });
}

/** 422 with every row problem; nothing of the document is stored. */
export function importInvalid(
  errors: readonly DictionaryRowError[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'DICTIONARY_IMPORT_INVALID',
    message: `The import has ${errors.length} invalid row(s); nothing was stored`,
    details: { errors },
  });
}

/** 422 on an event write whose failure codes are not in the dictionary in force (SME D11). */
export function failureCodesUnknown(
  problems: readonly FieldProblem[],
): UnprocessableEntityException {
  return new UnprocessableEntityException({
    code: 'FAILURE_CODE_UNKNOWN',
    message: problems.map((p) => p.message),
    fieldErrors: problems.map((p) => ({ field: p.field, message: p.message })),
  });
}
