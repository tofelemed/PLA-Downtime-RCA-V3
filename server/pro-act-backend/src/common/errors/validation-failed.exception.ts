import { HttpException, HttpStatus } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { FieldError } from './api-error-body';

/**
 * Raised by the global ValidationPipe for class-validator failures.
 *
 * Carries the flattened `fieldErrors` so the ApiExceptionFilter can emit the API03 envelope.
 * The status defaults to 400 (what v1 clients expect); the filter upgrades it to 422 for /api/v2 routes.
 */
export class ValidationFailedException extends HttpException {
  readonly fieldErrors: FieldError[];
  readonly messages: string[];

  constructor(errors: ValidationError[]) {
    const fieldErrors = flattenValidationErrors(errors);
    const messages = fieldErrors.map((error) => error.message);
    super(
      { code: 'VALIDATION_FAILED', message: messages, fieldErrors },
      HttpStatus.BAD_REQUEST,
    );
    this.fieldErrors = fieldErrors;
    this.messages = messages;
  }
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  const result: FieldError[] = [];
  for (const error of errors) {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    for (const [constraint, message] of Object.entries(
      error.constraints ?? {},
    )) {
      result.push({ field, message, constraint });
    }
    if (error.children?.length) {
      result.push(...flattenValidationErrors(error.children, field));
    }
  }
  return result;
}
