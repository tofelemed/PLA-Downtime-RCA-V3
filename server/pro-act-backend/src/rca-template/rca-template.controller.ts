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
} from '@nestjs/common';
import { RCATemplateService } from './rca-template.service';
import { RCATemplate } from './rca-template.entity';
import { ApiTags, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateRcaTemplateDto } from './dto/create-rca-template.dto';
import { UpdateRcaTemplateDto } from './dto/update-rca-template.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { MASTER_DATA_WRITERS } from '../v2/master-data/common/master-data-writer';

@ApiTags('RCA Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-templates')
export class RCATemplateController {
  constructor(private readonly templateService: RCATemplateService) {}

  @Get()
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('category') category?: string,
  ): Promise<RCATemplate[]> {
    if (tenantId) {
      return this.templateService.findByTenant(tenantId);
    }
    if (organizationId) {
      return this.templateService.findByOrganization(organizationId);
    }
    if (category) {
      return this.templateService.findByCategory(category);
    }
    return this.templateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<RCATemplate | null> {
    return this.templateService.findOne(id);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Post()
  @ApiBody({ type: CreateRcaTemplateDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  create(@Body() data: CreateRcaTemplateDto): Promise<RCATemplate> {
    return this.templateService.create(data);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Put(':id')
  @ApiBody({ type: UpdateRcaTemplateDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  update(
    @Param('id') id: string,
    @Body() data: UpdateRcaTemplateDto,
  ): Promise<RCATemplate | null> {
    return this.templateService.update(id, data);
  }

  @Roles(...MASTER_DATA_WRITERS)
  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.templateService.remove(id);
  }
}
