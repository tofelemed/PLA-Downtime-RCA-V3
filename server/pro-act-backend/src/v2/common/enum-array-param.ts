import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional } from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';

/** Repeated enum filter: `?physicalTypes=downtime&physicalTypes=slowdown` (OR within). */
export function EnumArrayParam(values: readonly string[]): PropertyDecorator {
  return (target, key) => {
    ApiPropertyOptional({ type: [String], enum: values })(target, key);
    IsOptional()(target, key);
    Transform(toArrayParam)(target, key);
    IsArray()(target, key);
    ArrayMaxSize(values.length)(target, key);
    IsIn(values, { each: true })(target, key);
  };
}
