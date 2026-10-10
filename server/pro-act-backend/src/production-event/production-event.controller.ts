import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import {
  ApiTags,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { ProductionEventQueryDto } from './dto/production-event-query.dto';
import { PagedResult } from '../common/dto/paged-result';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  attachmentUploadOptions,
  uploadedFileView,
} from '../common/http/upload-options';
import type { Request } from 'express';

@ApiTags('Production Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production-events')
export class ProductionEventController {
  constructor(private readonly eventService: ProductionEventService) {}

  /**
   * All filters are ANDed; `startDate`/`endDate` use overlap semantics. Returns a plain array unless
   * `page` or `pageSize` is given, in which case the response is `{ items, total, page, pageSize }`.
   */
  @Get()
  @ApiOperation({
    summary: 'List production events (AND-combined filters, optional paging)',
  })
  findAll(
    @Query() query: ProductionEventQueryDto,
  ): Promise<ProductionEvent[] | PagedResult<ProductionEvent>> {
    if (query.page !== undefined || query.pageSize !== undefined) {
      return this.eventService.searchPage(query);
    }
    return this.eventService.search(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ProductionEvent | null> {
    return this.eventService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateProductionEventDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateProductionEventDto): Promise<ProductionEvent> {
    return this.eventService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateProductionEventDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id') id: string,
    @Body() data: UpdateProductionEventDto,
  ): Promise<ProductionEvent | null> {
    return this.eventService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.eventService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload production event attachment' })
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
  @UseInterceptors(FileInterceptor('file', attachmentUploadOptions()))
  uploadEventAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Req() request: Request,
  ) {
    return uploadedFileView(file, request);
  }
}
