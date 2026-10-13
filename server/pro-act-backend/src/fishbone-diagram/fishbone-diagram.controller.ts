import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FishboneDiagramService } from './fishbone-diagram.service';
import { CreateFishboneDiagramDto } from './dto/create-fishbone-diagram.dto';
import { UpdateFishboneDiagramDto } from './dto/update-fishbone-diagram.dto';
import { FishboneDiagram } from './fishbone-diagram.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RCA_WRITERS } from '../rca-case/rca-scope';

@ApiTags('Fishbone Diagrams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fishbone-diagrams')
export class FishboneDiagramController {
  constructor(
    private readonly fishboneDiagramService: FishboneDiagramService,
  ) {}

  @Roles(...RCA_WRITERS)
  @Post()
  @ApiOperation({ summary: 'Create fishbone diagram' })
  @ApiResponse({
    status: 201,
    description: 'Diagram created successfully',
    type: FishboneDiagram,
  })
  create(
    @Body() createDto: CreateFishboneDiagramDto,
  ): Promise<FishboneDiagram> {
    return this.fishboneDiagramService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all fishbone diagrams' })
  @ApiQuery({ name: 'tenantId', required: false })
  @ApiQuery({ name: 'organizationId', required: false })
  @ApiQuery({ name: 'rcaId', required: false })
  @ApiResponse({
    status: 200,
    description: 'Return all diagrams',
    type: [FishboneDiagram],
  })
  findAll(
    @Query('tenantId') tenantId?: string,
    @Query('organizationId') organizationId?: string,
    @Query('rcaId') rcaId?: string,
  ): Promise<FishboneDiagram[]> {
    return this.fishboneDiagramService.findAll({
      tenantId,
      organizationId,
      rcaId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get fishbone diagram by ID' })
  @ApiResponse({
    status: 200,
    description: 'Return diagram',
    type: FishboneDiagram,
  })
  findOne(@Param('id') id: string): Promise<FishboneDiagram> {
    return this.fishboneDiagramService.findOne(id);
  }

  @Roles(...RCA_WRITERS)
  @Patch(':id')
  @ApiOperation({ summary: 'Update fishbone diagram' })
  @ApiResponse({
    status: 200,
    description: 'Diagram updated successfully',
    type: FishboneDiagram,
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateFishboneDiagramDto,
  ): Promise<FishboneDiagram> {
    return this.fishboneDiagramService.update(id, updateDto);
  }

  @Roles(...RCA_WRITERS)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete fishbone diagram' })
  @ApiResponse({ status: 204, description: 'Diagram deleted successfully' })
  remove(@Param('id') id: string): Promise<void> {
    return this.fishboneDiagramService.remove(id);
  }
}
