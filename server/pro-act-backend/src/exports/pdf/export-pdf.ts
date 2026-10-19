import { Injectable } from '@nestjs/common';
import { ExportJob } from '../entities/export-job.entity';
import { ExportHeader, RenderSource } from '../export-report';
import { basisText, sourceSection } from './pdf-content';
import { drawDocument } from './pdf-draw';
import { PdfFonts, resolvePdfFonts } from './pdf-fonts';
import { layoutDocument } from './pdf-layout';
import { ExportPresentation, PdfDocumentModel } from './pdf-model';
import { PdfSink, PdfSurfaceFactory } from './pdf-surface';
import { createPdfKitSurface } from './pdfkit-surface';

export function exportHeaderOf(job: ExportJob): ExportHeader {
  return {
    jobId: job.id,
    reportType: job.reportType,
    revisionSelector: job.revisionSelector,
    filters: job.filters,
    requestedAt: job.createdAt.toISOString(),
    requestedBy: job.requestedBy,
    sourceCount: job.counts.accepted,
    labels: job.labels ?? null,
  };
}

/** The pinned presentation as drawn: Persian digits only when the font has their glyphs. */
export function drawnPresentation(
  presentation: ExportPresentation,
  fonts: PdfFonts,
): ExportPresentation {
  return fonts.unicode ? presentation : { ...presentation, digits: 'latin' };
}

/** The laid-out document of a PDF export job and the number of table rows it prints. */
export function pdfDocumentOf(
  job: ExportJob,
  sources: readonly RenderSource[],
  fonts: PdfFonts,
): { model: PdfDocumentModel; rowCount: number } {
  if (!job.presentation) {
    throw new Error(`PDF export ${job.id} has no pinned presentation`);
  }
  const presentation = drawnPresentation(job.presentation, fonts);
  const sections = sources.map((s) =>
    sourceSection(job.reportType, s, presentation, job.labels ?? null),
  );
  const model = layoutDocument({
    header: exportHeaderOf(job),
    presentation,
    sections,
    bases: [...new Set(sources.map((s) => basisText(s, false)))],
  });
  const rowCount = sections.reduce((sum, s) => sum + s.rows.length, 0);
  return { model, rowCount };
}

/**
 * Draws PDF exports (owner 15 Oct): the layout is built from the pinned approved snapshots only and
 * drawn on a surface; the pdfkit surface is the default and tests replace `surfaces`.
 */
@Injectable()
export class ExportPdfWriter {
  fonts: () => PdfFonts = () => resolvePdfFonts();
  surfaces: PdfSurfaceFactory = (sink, info) =>
    createPdfKitSurface(sink, info, this.fonts());

  async write(
    job: ExportJob,
    sources: readonly RenderSource[],
    sink: PdfSink,
  ): Promise<number> {
    const { model, rowCount } = pdfDocumentOf(job, sources, this.fonts());
    const surface = await this.surfaces(sink, model.info);
    await drawDocument(model, surface);
    return rowCount;
  }
}
