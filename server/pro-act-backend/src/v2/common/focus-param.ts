import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * `focus=<id>` of a keyset list (deep links to one row): the first page starts at that row — the page
 * containing it — instead of at the start of the list; ignored with `cursor` and when the row is not in the
 * filtered list (the first page is returned).
 */
export function FocusParam(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({
      format: 'uuid',
      description:
        'Id of a row to open: the first page starts at that row (keyset seek to its sort key); ignored with cursor or when the row is not in the filtered list',
    }),
    IsOptional(),
    IsUUID(),
  );
}
