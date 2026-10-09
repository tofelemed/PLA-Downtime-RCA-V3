import { HEADERS_METADATA } from '@nestjs/common/constants';
import { OEESummaryController } from './oee-summary.controller';

/** Plan 2.5 step 6: the v1 OEE summary writes are deprecated (410 Gone with plan 3.5). */
describe('OEE summary writes are deprecated', () => {
  it.each(['create', 'update', 'remove'] as const)(
    '%s answers with Deprecation: true',
    (method) => {
      const headers = Reflect.getMetadata(
        HEADERS_METADATA,
        OEESummaryController.prototype[method],
      ) as Array<{ name: string; value: string }>;
      expect(headers).toEqual([{ name: 'Deprecation', value: 'true' }]);
    },
  );

  it('reads are not deprecated', () => {
    expect(
      Reflect.getMetadata(
        HEADERS_METADATA,
        Object.getOwnPropertyDescriptor(
          OEESummaryController.prototype,
          'findAll',
        )?.value as object,
      ),
    ).toBeUndefined();
  });
});
