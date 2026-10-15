import { readAttributes } from './pi-attribute-reader';
import { getMany } from './pi-batch';
import { PiHttpClient } from './pi-http-client';

jest.mock('./pi-batch', () => ({
  getMany: jest.fn(),
  assertAnswer: jest.fn(),
}));

describe('PI frame attribute unit metadata', () => {
  it('requests and retains explicit stream units alongside the value', async () => {
    const client = {} as PiHttpClient;
    jest.mocked(getMany).mockResolvedValue({
      batchUnsupported: false,
      answers: [
        {
          status: 200,
          content: {
            Items: [
              {
                Name: 'Quantity',
                Value: { Value: 9.6, UnitsAbbreviation: 't' },
              },
            ],
          },
        },
      ],
    });
    const result = await readAttributes(client, ['EF-1'], true);
    expect(getMany).toHaveBeenLastCalledWith(
      client,
      [expect.stringContaining('Items.Value.UnitsAbbreviation')],
      true,
    );
    expect(result.values.get('EF-1')).toEqual({
      Quantity: { Value: 9.6, UnitsAbbreviation: 't' },
    });
  });

  it('keeps values without units unchanged and preserves digital states', async () => {
    const digital = { Name: 'BEARING', Value: 3, IsSystem: false };
    jest.mocked(getMany).mockResolvedValue({
      batchUnsupported: false,
      answers: [
        {
          status: 200,
          content: {
            Items: [
              { Name: 'Quantity', Value: { Value: 9.6 } },
              { Name: 'ReasonCode', Value: { Value: digital } },
            ],
          },
        },
      ],
    });
    const result = await readAttributes({} as PiHttpClient, ['EF-1'], true);
    expect(result.values.get('EF-1')).toEqual({
      Quantity: 9.6,
      ReasonCode: digital,
    });
  });
});
