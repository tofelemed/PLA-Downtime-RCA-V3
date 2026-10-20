import { MoneyFields } from '../auth/money/money.decorators';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ProductionEventService } from './production-event.service';
import { ProductionEvent } from './production-event.entity';
import { ApiTags, ApiBearerAuth, ApiBody, ApiOperation } from '@nestjs/swagger';
import { TenantBound } from '../auth/decorators/tenant-bound.decorator';
import { CreateProductionEventDto } from './dto/create-production-event.dto';
import { UpdateProductionEventDto } from './dto/update-production-event.dto';
import { ProductionEventQueryDto } from './dto/production-event-query.dto';
import { PagedResult } from '../common/dto/paged-result';

@ApiTags('Production Events')
@ApiBearerAuth()
@TenantBound()
@Controller('production-events')
// QA re-test 2026-10-19: an event's recorded cost is money (left out for operators)
@MoneyFields('cost')
export class ProductionEventController {
  constructor(private readonly eventService: ProductionEventService) {}

  /**
   * All filters are ANDed; `startDate`/`endDate` use overlap semantics. Always one page
   * `{ items, total, page, pageSize }` (default 50 rows, at most 200): the unpaged array is retired
   * (plan 1.6, D-T2). Kept for the demo seeders, e2e and integration fixtures; the app reads v2.
   */
  @Get()
  @ApiOperation({
    summary: 'List production events (AND-combined filters, paged)',
  })
  findAll(
    @Query() query: ProductionEventQueryDto,
  ): Promise<PagedResult<ProductionEvent>> {
    return this.eventService.searchPage(query);
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
}
