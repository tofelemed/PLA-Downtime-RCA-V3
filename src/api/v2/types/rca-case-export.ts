/**
 * `POST /v2/exports` for one RCA case (item 2.5; backend `src/exports/rca-case/*`). Hand-written until the
 * OpenAPI types are regenerated: the body is the export request with `reportType: 'rca_case'`, the `case`
 * selector and the case id. The PDF is rendered on the server in the display currency.
 */
export interface RcaCaseExportRequest {
  reportType: 'rca_case';
  format: 'pdf';
  revisionSelector: 'case';
  rcaId: string;
  currency: 'USD' | 'IRR';
}
