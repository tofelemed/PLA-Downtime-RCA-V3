import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import {
  resolveAttachment,
  StoredAttachment,
} from '../common/http/attachment-download';
import { assertCanUpload } from './action-owner-access';
import { recordRcaAudit } from './rca-audit';
import { readEvidence } from './rca-case-json';
import { findCase, scopeOf } from './rca-scope';

/** A stored evidence file, ready to be referenced by an evidence item of the case. */
export interface RcaAttachmentV2View {
  fileName: string;
  name: string;
  contentType: string | null;
  size: number;
}

/**
 * Evidence files of a case (v1 parity: photos, documents, videos with an evidence item). Files go to the
 * tenant's upload folder (shared upload limits and type allowlist); a case only serves files that one of
 * its evidence items or one of its actions' completion evidence (CA4) references.
 */
@Injectable()
export class RcaAttachmentsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async stored(
    context: RequestContext,
    rcaId: string,
    file: Express.Multer.File,
  ): Promise<RcaAttachmentV2View> {
    const scope = scopeOf(context);
    try {
      await findCase(this.dataSource.manager, scope, rcaId);
      await assertCanUpload(this.dataSource.manager, context, {
        tenantId: scope.tenantId,
        rcaId,
      });
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
    await recordRcaAudit(this.dataSource.manager, scope, [
      {
        entityType: 'rca_case',
        entityId: rcaId,
        caseId: rcaId,
        action: 'attachment_uploaded',
        before: null,
        after: null,
        detail: { fileName: file.filename, size: file.size },
      },
    ]);
    return {
      fileName: file.filename,
      name: file.originalname,
      contentType: file.mimetype || null,
      size: file.size,
    };
  }

  async resolve(
    context: RequestContext,
    rcaId: string,
    fileName: string,
  ): Promise<StoredAttachment> {
    const scope = scopeOf(context);
    const rca = await findCase(this.dataSource.manager, scope, rcaId);
    const referenced =
      readEvidence(rca.evidence).some((item) =>
        item.attachments.some((attachment) => attachment.fileName === fileName),
      ) || (await this.actionReferences(scope.tenantId, rcaId, fileName));
    if (!referenced) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }
    return resolveAttachment(context, scope.tenantId, fileName);
  }

  /** CA4: a completion file of one of the case's actions. */
  private async actionReferences(
    tenantId: string,
    rcaId: string,
    fileName: string,
  ): Promise<boolean> {
    const rows: unknown[] = await this.dataSource.query(
      `SELECT 1 FROM "rca_actions" WHERE "tenant_id" = $1 AND "rca_id" = $2
          AND "completion_attachments" @> jsonb_build_array(jsonb_build_object('fileName', $3::text)) LIMIT 1`,
      [tenantId, rcaId, fileName],
    );
    return rows.length > 0;
  }
}
