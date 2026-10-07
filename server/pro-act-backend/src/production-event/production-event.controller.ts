import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, UsePipes, ValidationPipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { ApiTags, ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@ApiTags('Production Events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('production-events')
export class ProductionEventController {
  constructor(private readonly eventService: ProductionEventService) {}

  @Get()
  findAll(
    @Query('unitId') unitId?: string,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tenantId') tenantId?: string,
  ): Promise<ProductionEvent[]> {
    if (tenantId) {
      return this.eventService.findByTenant(tenantId);
    }
    if (unitId) {
      return this.eventService.findByUnit(unitId);
    }
    if (status) {
      return this.eventService.findByStatus(status);
    }
    if (eventType) {
      return this.eventService.findByEventType(eventType);
    }
    if (startDate && endDate) {
      return this.eventService.findByDateRange(new Date(startDate), new Date(endDate));
    }
    return this.eventService.findAll();
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
  update(@Param('id') id: string, @Body() data: UpdateProductionEventDto): Promise<ProductionEvent | null> {
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
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
  }))
  uploadEventAttachment(@UploadedFile() file: Express.Multer.File) {
    return {
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
} 