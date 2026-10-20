import type { PiHttpClient } from './pi-http-client';
import { readRecorded } from './pi-streams';

/** Many signals never put all WebIds in one URL (integration audit 19 Oct 2026). */
describe('PI recorded values', () => {
  it('asks for at most 40 streams per request and keeps the requested order', async () => {
    const asked: string[][] = [];
    const client = {
      get: (path: string) => {
        const webIds = new URLSearchParams(path.split('?')[1]).getAll('webId');
        asked.push(webIds);
        return Promise.resolve({
          Items: webIds.map((webId) => ({
            WebId: webId,
            Items: [
              { Timestamp: '2026-10-19T08:00:00Z', Value: 1, Good: true },
            ],
          })),
        });
      },
    } as unknown as PiHttpClient;
    const webIds = Array.from({ length: 95 }, (_, index) => `F1Ab${index}`);
    const values = await readRecorded(client, {
      webIds,
      start: '2026-10-19T07:00:00Z',
      end: '2026-10-19T09:00:00Z',
      maxCount: 10,
    });
    expect(asked.map((chunk) => chunk.length)).toEqual([40, 40, 15]);
    expect(values.map((stream) => stream.webId)).toEqual(webIds);
  });
});
