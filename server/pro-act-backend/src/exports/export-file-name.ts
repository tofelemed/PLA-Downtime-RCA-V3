import { ExportJob } from './entities/export-job.entity';
import { plantIso } from './export-words';
import { productNameOf } from './report/report-pdf-kit';

/** Lower-case words joined by "-" (letters and digits of any script kept), for a file name. */
function slug(text: string): string {
  return (
    text
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'export'
  );
}

/**
 * The download name of an export: product, plant, report and the plant day the window starts on —
 * `traverse-forge-marun-hdpe-daily-2026-10-20.pdf` (settings audit, 21 Oct 2026: it was
 * `proact-<kind>-<job id>`, so files of different plants and days could not be told apart).
 */
export function exportFileName(job: ExportJob, kind: string): string {
  const presentation = job.presentation;
  const from = job.filters?.from ?? job.createdAt.toISOString();
  const day = (plantIso(from, presentation?.timezone ?? 'UTC') ?? from).slice(
    0,
    10,
  );
  const parts = [
    slug(productNameOf(presentation?.brand)),
    presentation ? slug(presentation.plantName) : null,
    slug(kind),
    day,
  ].filter((part): part is string => Boolean(part));
  return `${parts.join('-')}.${job.format}`;
}
