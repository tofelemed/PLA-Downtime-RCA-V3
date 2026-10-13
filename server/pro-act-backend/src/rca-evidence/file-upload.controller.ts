import {
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiBody,
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { resolveAttachment } from '../common/http/attachment-download';
import {
  attachmentUploadOptions,
  uploadedFileView,
} from '../common/http/upload-options';
import { Ctx } from '../common/context/ctx.decorator';
import { RequestContext } from '../common/context/request-context';
import { Roles } from '../auth/decorators/roles.decorator';
import { RCA_WRITERS } from '../rca-case/rca-scope';

@ApiTags('File Upload')
@ApiBearerAuth()
@Controller('uploads')
export class FileUploadController {
  @Roles(...RCA_WRITERS)
  @Post('evidence')
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions()))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  uploadEvidenceFile(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    const view = uploadedFileView(file, request);
    // `originalname` kept for existing v1 callers
    return { ...view, originalname: view.originalName };
  }

  @Get('files/:tenantId/:name')
  @ApiOperation({
    summary:
      'Download an uploaded file (token required; members of the tenant only, others 404)',
  })
  download(
    @Ctx() ctx: RequestContext,
    @Param('tenantId') tenantId: string,
    @Param('name') name: string,
    @Res({ passthrough: true }) res: Response,
  ): StreamableFile {
    const file = resolveAttachment(ctx, tenantId, name);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(createReadStream(file.absolutePath), {
      type: file.contentType,
      disposition: `${file.inline ? 'inline' : 'attachment'}; filename="${name.toLowerCase()}"`,
    });
  }
}
