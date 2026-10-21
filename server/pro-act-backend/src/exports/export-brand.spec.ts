import { EntityManager } from 'typeorm';
import { brandLogoOf, exportBrandOf } from './export-brand';
import { exportFileName } from './export-file-name';
import { productNameOf, THEME, themeOf } from './report/report-pdf-kit';
import { ExportJob } from './entities/export-job.entity';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const managerWith = (value: object | null) =>
  ({
    query: jest.fn(() =>
      Promise.resolve(value ? [{ value: JSON.stringify(value) }] : []),
    ),
  }) as unknown as EntityManager;

describe('report exports follow the branding (owner 21 Oct 2026)', () => {
  it('keeps the original look while no branding is stored', async () => {
    expect(await exportBrandOf(managerWith(null))).toBeNull();
    expect(themeOf(null)).toBe(THEME);
    expect(productNameOf(null)).toBe('Traverse Forge');
    expect(await brandLogoOf(managerWith(null))).toBeNull();
  });

  it('uses the stored name and colours, and an inline PNG or JPEG logo', async () => {
    const manager = managerWith({
      appName: 'Marun Analytics',
      primaryColor: '#0a7f4f',
      secondaryColor: '#f59e0b',
      logoUrl: PNG,
    });
    const brand = await exportBrandOf(manager);
    expect(brand).toEqual({
      appName: 'Marun Analytics',
      primaryColor: '#0a7f4f',
      secondaryColor: '#f59e0b',
    });
    expect(themeOf(brand)).toMatchObject({ navy: '#0a7f4f', red: '#f59e0b' });
    expect((await brandLogoOf(manager))?.length).toBeGreaterThan(0);
  });

  it('never fetches a logo from the web and ignores invalid stored values', async () => {
    const manager = managerWith({
      appName: 'X',
      primaryColor: 'url(https://evil.test)',
      logoUrl: 'https://cdn.test/logo.png',
    });
    expect(await brandLogoOf(manager)).toBeNull();
    expect((await exportBrandOf(manager))?.primaryColor).toBe('#2563eb');
  });

  it('names a download by product, plant, report and the plant day it starts on', () => {
    const job = {
      format: 'pdf',
      createdAt: new Date('2026-10-21T08:00:00Z'),
      filters: { from: '2026-10-19T20:30:00.000Z' },
      presentation: {
        plantName: 'Marun HDPE',
        timezone: 'Asia/Tehran',
        brand: null,
      },
    } as unknown as ExportJob;
    expect(exportFileName(job, 'daily')).toBe(
      'traverse-forge-marun-hdpe-daily-2026-10-20.pdf',
    );
  });
});
