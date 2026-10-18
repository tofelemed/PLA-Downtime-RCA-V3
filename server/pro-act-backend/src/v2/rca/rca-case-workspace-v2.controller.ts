import {
  Body,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ETagInterceptor } from '../../common/concurrency/etag.interceptor';
import { parseIfMatch } from '../../common/concurrency/revision';
import { Ctx } from '../../common/context/ctx.decorator';
import { RequestContext } from '../../common/context/request-context';
import { attachmentUploadOptions } from '../../common/http/upload-options';
import { RcaAnalysesService } from '../../rca-case/rca-analyses.service';
import {
  BarrierView,
  ChangeView,
  FaultTreeView,
  FishboneView,
  FiveWhyView,
  FmeaView,
  RcaAnalysesV2View,
} from '../../rca-case/rca-analysis.view';
import {
  RcaAttachmentsService,
  RcaAttachmentV2View,
} from '../../rca-case/rca-attachments.service';
import { RCA_WRITERS } from '../../rca-case/rca-scope';
import { TenantQueryParamGuard } from '../common/tenant-query-param.guard';
import {
  BarrierV2Dto,
  ChangeV2Dto,
  FaultTreeV2Dto,
  FishboneV2Dto,
  FiveWhyV2Dto,
  FmeaV2Dto,
} from './rca-analyses-v2.dto';

/** `If-Match` of a create-or-replace: absent = first save of the tool, else the row version read. */
const SaveRevision = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number | null => {
    const header = context.switchToHttp().getRequest<Request>().headers[
      'if-match'
    ];
    return header === undefined ? null : parseIfMatch(header);
  },
);

const SAVE =
  'Replaces the tool record as sent. First save: no `If-Match`; later saves: `If-Match` = the rowVersion read ' +
  '(412 STALE_REVISION when someone saved meanwhile). Writers: reliability engineer or manager approver.';

const ID = new ParseUUIDPipe();

/**
 * The analysis workspace of a case (plan 3.9 follow-up, v1 parity): the record of each analysis tool
 * (5-Why, fishbone, FMEA, fault tree, barrier, change) and the evidence files.
 */
@ApiTags('v2 · RCA')
@ApiBearerAuth()
@UseGuards(TenantQueryParamGuard)
@Controller({ path: 'rcas', version: '2' })
export class RcaCaseWorkspaceV2Controller {
  constructor(
    private readonly analyses: RcaAnalysesService,
    private readonly attachments: RcaAttachmentsService,
  ) {}

  @Get(':id/analyses')
  @ApiOperation({
    summary: 'The analysis tool records of a case (null = not saved yet)',
  })
  list(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
  ): Promise<RcaAnalysesV2View> {
    return this.analyses.list(ctx, id);
  }

  @Put(':id/analyses/five-why')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Save the 5-Why analysis', description: SAVE })
  @ApiHeader({ name: 'If-Match', required: false })
  fiveWhy(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: FiveWhyV2Dto,
  ): Promise<FiveWhyView> {
    return this.analyses.saveFiveWhy(ctx, { rcaId: id, expected }, body);
  }

  @Put(':id/analyses/fishbone')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Save the fishbone (Ishikawa) diagram',
    description: SAVE,
  })
  @ApiHeader({ name: 'If-Match', required: false })
  fishbone(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: FishboneV2Dto,
  ): Promise<FishboneView> {
    return this.analyses.saveFishbone(ctx, { rcaId: id, expected }, body);
  }

  @Put(':id/analyses/fmea')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({
    summary: 'Save the FMEA (the server computes each cause RPN)',
    description: SAVE,
  })
  @ApiHeader({ name: 'If-Match', required: false })
  fmea(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: FmeaV2Dto,
  ): Promise<FmeaView> {
    return this.analyses.saveFmea(ctx, { rcaId: id, expected }, body);
  }

  @Put(':id/analyses/fault-tree')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Save the fault tree', description: SAVE })
  @ApiHeader({ name: 'If-Match', required: false })
  faultTree(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: FaultTreeV2Dto,
  ): Promise<FaultTreeView> {
    return this.analyses.saveFaultTree(ctx, { rcaId: id, expected }, body);
  }

  @Put(':id/analyses/barrier')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Save the barrier analysis', description: SAVE })
  @ApiHeader({ name: 'If-Match', required: false })
  barrier(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: BarrierV2Dto,
  ): Promise<BarrierView> {
    return this.analyses.saveBarrier(ctx, { rcaId: id, expected }, body);
  }

  @Put(':id/analyses/change')
  @Roles(...RCA_WRITERS)
  @UseInterceptors(ETagInterceptor)
  @ApiOperation({ summary: 'Save the change analysis', description: SAVE })
  @ApiHeader({ name: 'If-Match', required: false })
  change(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @SaveRevision() expected: number | null,
    @Body() body: ChangeV2Dto,
  ): Promise<ChangeView> {
    return this.analyses.saveChange(ctx, { rcaId: id, expected }, body);
  }

  @Post(':id/attachments')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions()))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({
    summary:
      'Store an evidence file of the case (25 MiB, documents / images / videos)',
    description:
      'RCA writers, or the owner of an open action of the case (completion evidence; 403 FORBIDDEN_ROLE otherwise). ' +
      'Answers the stored file name; reference it from an evidence item (`attachments`) and save the case. ' +
      'Not idempotent: a repeated upload stores another file, an unreferenced file is never served.',
  })
  upload(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<RcaAttachmentV2View> {
    return this.attachments.stored(ctx, id, file);
  }

  @Get(':id/attachments/:fileName')
  @ApiOperation({
    summary: 'Download an evidence file the case references (others 404)',
  })
  async download(
    @Ctx() ctx: RequestContext,
    @Param('id', ID) id: string,
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.attachments.resolve(ctx, id, fileName);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(createReadStream(file.absolutePath), {
      type: file.contentType,
      disposition: `${file.inline ? 'inline' : 'attachment'}; filename="${fileName.toLowerCase()}"`,
    });
  }
}
