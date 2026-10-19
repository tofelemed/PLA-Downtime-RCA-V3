import { UnprocessableEntityException } from '@nestjs/common';
import { ValidationFailedException } from '../../common/errors/validation-failed.exception';
import { createValidationPipe } from '../../common/validation/validation-pipe.factory';
import { parseBundleView, parseBundleViews } from './downtime-bundle-report';
import { DowntimeBundleQueryDto } from './kpi-reports-v2.dto';

const WINDOW = { from: '2027-03-01T00:00:00Z', to: '2027-03-02T00:00:00Z' };

function parse(query: Record<string, unknown>) {
  return createValidationPipe().transform(query, {
    type: 'query',
    metatype: DowntimeBundleQueryDto,
  }) as Promise<DowntimeBundleQueryDto>;
}

async function rejectedFields(
  query: Record<string, unknown>,
): Promise<string[]> {
  try {
    await parse(query);
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationFailedException);
    return (error as ValidationFailedException).fieldErrors.map((f) => f.field);
  }
  throw new Error('expected validation to fail');
}

describe('downtime bundle view tokens (T24)', () => {
  it('defaults the metric to duration and the class to every class', () => {
    expect(parseBundleView('reasonLevel1')).toEqual({
      view: 'reasonLevel1',
      groupBy: 'reasonLevel1',
      metric: 'duration',
      scheduleClass: null,
    });
  });

  it('reads metric and class, each optional', () => {
    expect(parseBundleView('asset:frequency:unplanned')).toMatchObject({
      groupBy: 'asset',
      metric: 'frequency',
      scheduleClass: 'unplanned',
    });
    expect(parseBundleView('day:planned')).toMatchObject({
      groupBy: 'day',
      metric: 'duration',
      scheduleClass: 'planned',
    });
    expect(parseBundleView('week:frequency')).toMatchObject({
      metric: 'frequency',
      scheduleClass: null,
    });
  });

  it('keeps request order and answers a repeated token once', () => {
    expect(
      parseBundleViews(['oee', 'reason', 'oee', 'reason:duration']).map(
        (v) => v.view,
      ),
    ).toEqual(['oee', 'reason', 'reason:duration']);
  });

  it('refuses tokens outside the grammar (422)', () => {
    for (const token of [
      'reasonChild',
      'asset:unplanned:frequency',
      'asset:',
      'year',
    ]) {
      expect(() => parseBundleView(token)).toThrow(
        UnprocessableEntityException,
      );
    }
  });

  it('query: single and repeated views, booleans from text', async () => {
    expect((await parse({ ...WINDOW, views: 'reason' })).views).toEqual([
      'reason',
    ]);
    const parsed = await parse({
      ...WINDOW,
      views: ['reason', 'asset:frequency'],
      includeMicroStops: 'false',
    });
    expect(parsed.views).toEqual(['reason', 'asset:frequency']);
    expect(parsed.includeMicroStops).toBe(false);
  });

  it('query: views required, at most 12, each in the grammar', async () => {
    expect(await rejectedFields(WINDOW)).toContain('views');
    expect(
      await rejectedFields({ ...WINDOW, views: Array(13).fill('reason') }),
    ).toContain('views');
    expect(
      await rejectedFields({ ...WINDOW, views: ['reasonChild'] }),
    ).toContain('views');
    expect(
      await rejectedFields({ ...WINDOW, views: 'reason', parentReasonId: 'x' }),
    ).toContain('parentReasonId');
  });

  it('query: the summary may follow one schedule class (owner decision 2026-10-19)', async () => {
    const parsed = await parse({
      ...WINDOW,
      views: 'day',
      scheduleClass: 'planned',
    });
    expect(parsed.scheduleClass).toBe('planned');
    expect((await parse({ ...WINDOW, views: 'day' })).scheduleClass).toBe(
      undefined,
    );
    expect(
      await rejectedFields({ ...WINDOW, views: 'day', scheduleClass: 'all' }),
    ).toContain('scheduleClass');
  });
});
