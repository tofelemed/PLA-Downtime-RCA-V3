import { ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { ValidationFailedException } from '../errors/validation-failed.exception';

/**
 * Options of the global pipe: undeclared fields are rejected (`forbidNonWhitelisted`), query strings are
 * coerced to the DTO types, and failures surface as ValidationFailedException for the API03 envelope.
 */
export const GLOBAL_VALIDATION_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
  exceptionFactory: (errors) => new ValidationFailedException(errors),
};

export function createValidationPipe(
  overrides: Partial<ValidationPipeOptions> = {},
): ValidationPipe {
  return new ValidationPipe({ ...GLOBAL_VALIDATION_OPTIONS, ...overrides });
}
