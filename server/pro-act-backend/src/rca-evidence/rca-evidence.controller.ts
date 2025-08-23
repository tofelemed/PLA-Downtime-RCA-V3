import { Controller, Get, Post, Put, Delete, Param, Body, UseInterceptors, UploadedFile, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { RCAEvidenceService } from './rca-evidence.service';
import { RCAEvidence } from './rca-evidence.entity';
import { CreateRCAEvidenceDto } from './dto/create-rca-evidence.dto';
import { UpdateRCAEvidenceDto } from './dto/update-rca-evidence.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('RCA Evidence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-evidence')
export class RCAEvidenceController {
  constructor(private readonly evidenceService: RCAEvidenceService) {}

  @Get()
  findAll(): Promise<RCAEvidence[]> {
    return this.evidenceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<RCAEvidence | null> {
    return this.evidenceService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateRCAEvidenceDto })
  create(@Body() data: CreateRCAEvidenceDto): Promise<RCAEvidence> {
    return this.evidenceService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateRCAEvidenceDto })
  update(@Param('id') id: string, @Body() data: UpdateRCAEvidenceDto): Promise<RCAEvidence | null> {
    return this.evidenceService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.evidenceService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload RCA evidence file' })
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
  uploadEvidenceFile(@UploadedFile() file: Express.Multer.File) {
    return {
      originalName: file.originalname,
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
} 