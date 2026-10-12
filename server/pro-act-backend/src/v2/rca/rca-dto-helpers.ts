import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';

type Decorators = PropertyDecorator[];

function apply(decorators: Decorators): PropertyDecorator {
  return (target, key) => {
    for (const decorator of decorators) decorator(target, key);
  };
}

/** `null` and absence are accepted; anything else is validated by `rules`. */
function nullable(
  rules: Decorators,
  doc: Parameters<typeof ApiPropertyOptional>[0],
): PropertyDecorator {
  return apply([
    IsOptional(),
    ValidateIf((_: unknown, value: unknown) => value !== null),
    ...rules,
    ApiPropertyOptional({ nullable: true, ...doc }),
  ]);
}

/** Optional text of at most `max` characters (null = cleared). */
export const OptionalText = (max: number): PropertyDecorator =>
  nullable([IsString(), MaxLength(max)], { maxLength: max });

/** Optional ISO 8601 instant or calendar date (null = cleared). */
export const OptionalIso = (): PropertyDecorator =>
  nullable([IsISO8601()], { type: String });

/** Optional uuid (null = cleared). */
export const OptionalUuid = (): PropertyDecorator =>
  nullable([IsUUID()], { type: String });

/** Optional boolean (null = not stated). */
export const OptionalBool = (): PropertyDecorator =>
  nullable([IsBoolean()], { type: Boolean });

/** Optional value of a closed list (null = not stated). */
export const OptionalIn = (values: readonly string[]): PropertyDecorator =>
  nullable([IsIn(values)], { enum: values as string[] });

/** Optional list of short strings (tags, node ids). */
export const OptionalStrings = (
  maxItems: number,
  maxLength: number,
): PropertyDecorator =>
  apply([
    IsOptional(),
    IsArray(),
    ArrayMaxSize(maxItems),
    IsString({ each: true }),
    MaxLength(maxLength, { each: true }),
    ApiPropertyOptional({ type: [String], maxItems }),
  ]);
