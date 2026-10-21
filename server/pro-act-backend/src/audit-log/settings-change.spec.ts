import { changedFields, changeSummary } from './settings-change';

describe('settings change audit (21 Oct 2026)', () => {
  it('keeps only the named fields whose value changed, with old and new values', () => {
    const changes = changedFields(
      { name: 'Marun', weekStart: 'monday', digits: 'latin', other: 1 },
      { name: 'Marun', weekStart: 'saturday', digits: 'latin', other: 2 },
      ['name', 'weekStart', 'digits'],
    );
    expect(changes).toEqual({ weekStart: { from: 'monday', to: 'saturday' } });
  });

  it('treats a missing value and null alike, and a cleared value as a change', () => {
    expect(changedFields({}, { description: null }, ['description'])).toEqual(
      {},
    );
    expect(
      changedFields({ description: 'Line 1' }, { description: null }, [
        'description',
      ]),
    ).toEqual({ description: { from: 'Line 1', to: null } });
  });

  it('summarises in words, with labels, "(none)" for an empty value and "(image)" for inline images', () => {
    const text = changeSummary(
      'Changed branding',
      {
        appSubtitle: { from: 'Loss accounting', to: null },
        logoUrl: { from: null, to: 'data:image/png;base64,AAAA' },
      },
      { appSubtitle: 'subtitle', logoUrl: 'logo' },
    );
    expect(text).toBe(
      'Changed branding: subtitle Loss accounting → (none); logo (none) → (image)',
    );
  });
});
