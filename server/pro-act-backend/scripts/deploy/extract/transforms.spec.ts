import { transformRow } from './transforms';

describe('transformRow', () => {
  it('seeds connections inactive and without a secret reference', () => {
    const row = {
      id: 'c1',
      is_active: true,
      secret_ref: 'secret:abc',
      endpoint_config: '{"mqtt": {}}',
    };
    expect(transformRow('integration_connections', row)).toEqual({
      id: 'c1',
      is_active: false,
      secret_ref: null,
      endpoint_config: '{"mqtt": {}}',
    });
    expect(row.is_active).toBe(true);
  });

  it('leaves the rows of other tables unchanged', () => {
    const row = { id: 's1', is_active: true, secret_ref: 'x' };
    expect(transformRow('signals', row)).toBe(row);
  });

  it('refuses a transform whose column the table lacks', () => {
    expect(() => transformRow('integration_connections', { id: 'c1' })).toThrow(
      /integration_connections\.(is_active|secret_ref)/,
    );
  });
});
