import type { PiEventFrame } from '../pi-frame-ingest.service';
import { normalizeFrame, withElementPath } from './pi-frame-shape';

const frame = (extra: Record<string, unknown>): PiEventFrame => ({
  WebId: 'F1Fm1',
  StartTime: '2026-10-19T07:52:10Z',
  ...extra,
});

/** Real PI Web API event frames name the primary element only by link / ids (sample PI, 19 Oct 2026). */
describe('PI frame shape', () => {
  it('reads the primary element from Links.PrimaryReferencedElement', () => {
    const shaped = normalizeFrame(
      frame({
        Links: {
          PrimaryReferencedElement: 'https://pi/piwebapi/elements/F1EmEX100',
        },
        RefElementWebIds: ['F1EmEX100', 'F1EmOTHER'],
      }),
    );
    expect(shaped.PrimaryReferencedElement).toEqual({
      WebId: 'F1EmEX100',
      Path: null,
    });
  });

  it('accepts PrimaryReferencedElementWebId and a single referenced element', () => {
    expect(
      normalizeFrame(frame({ PrimaryReferencedElementWebId: 'F1EmA' }))
        .PrimaryReferencedElement?.WebId,
    ).toBe('F1EmA');
    expect(
      normalizeFrame(frame({ RefElementWebIds: ['F1EmB'] }))
        .PrimaryReferencedElement?.WebId,
    ).toBe('F1EmB');
  });

  it('never guesses the primary among several referenced elements', () => {
    expect(
      normalizeFrame(frame({ RefElementWebIds: ['F1EmA', 'F1EmB'] }))
        .PrimaryReferencedElement,
    ).toBeUndefined();
  });

  it('keeps an embedded element as delivered', () => {
    const embedded = frame({
      PrimaryReferencedElement: { WebId: 'F1EmC', Path: '//af/db/C' },
    });
    expect(normalizeFrame(embedded)).toBe(embedded);
  });

  it('fills the looked-up path only when the frame has an element and no path', () => {
    const shaped = normalizeFrame(frame({ RefElementWebIds: ['F1EmB'] }));
    expect(
      withElementPath(shaped, '//af/db/B').PrimaryReferencedElement,
    ).toEqual({ WebId: 'F1EmB', Path: '//af/db/B' });
    expect(withElementPath(frame({}), '//af/db/B')).toEqual(frame({}));
  });
});
