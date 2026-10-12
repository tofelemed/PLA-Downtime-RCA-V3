import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { unlink } from 'fs/promises';
import { DataSource } from 'typeorm';
import { RequestContext } from '../common/context/request-context';
import {
  resolveAttachment,
  StoredAttachment,
} from '../common/http/attachment-download';
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
 * its evidence items references.
 */
@Injectable()
export class RcaAttachmentsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async stored(
    context: RequestContext,
    rcaId: string,
    file: Express.Multer.File,
  ): Promise<RcaAttachmentV2View> {
    try {
      await findCase(this.dataSource.manager, scopeOf(context), rcaId);
    } catch (error) {
      await unlink(file.path).catch(() => undefined);
      throw error;
    }
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
    const referenced = readEvidence(rca.evidence).some((item) =>
      item.attachments.some((attachment) => attachment.fileName === fileName),
    );
    if (!referenced) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }
    return resolveAttachment(context, scope.tenantId, fileName);
  }
}
