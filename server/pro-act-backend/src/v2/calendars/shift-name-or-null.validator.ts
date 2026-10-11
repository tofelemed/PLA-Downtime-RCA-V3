import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const SHIFT_NAME_MAX_LENGTH = 64;

/** A rotation cycle slot: the name of the shift the crew works, or null for a day off. */
export function isShiftNameOrNull(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.length > 0 &&
      value.length <= SHIFT_NAME_MAX_LENGTH)
  );
}

/**
 * Per-element rule for `RotationPatternDto.cycle`: class-validator's `@ValidateIf` is evaluated per
 * property, not per element, so `@IsString({ each: true })` would reject the `null` days off.
 */
export function IsShiftNameOrNullEach(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isShiftNameOrNullEach',
      target: target.constructor,
      propertyName: String(propertyName),
      options: {
        message: (args: ValidationArguments) =>
          `each value in ${args.property} must be a shift name of at most ${SHIFT_NAME_MAX_LENGTH} characters or null`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          Array.isArray(value) && value.every(isShiftNameOrNull),
      },
    });
  };
}
