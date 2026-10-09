import { HEADERS_METADATA } from '@nestjs/common/constants';
import { ReportingController } from './reporting.controller';

const headersOf = (method: keyof ReportingController) =>
  Reflect.getMetadata(
    HEADERS_METADATA,
    ReportingController.prototype[method],
  ) as Array<{ name: string; value: string }> | undefined;

/** Plan 2.7 step 4: the v1 OEE reports (mean of percentages) are deprecated in favour of /v2/reports/oee. */
describe('v1 OEE reports are deprecated', () => {
  it.each(['getOeeSummary', 'getOeeTrends'] as const)(
    '%s answers with Deprecation: true',
    (method) => {
      expect(headersOf(method)).toEqual([
        { name: 'Deprecation', value: 'true' },
      ]);
    },
  );

  it('other reports are not deprecated', () => {
    expect(headersOf('getProductionLoss')).toBeUndefined();
  });
});
