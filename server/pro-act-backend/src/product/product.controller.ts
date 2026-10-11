import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from './product.entity';
import { ApiBody, ApiTags, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantBound } from '../auth/decorators/tenant-bound.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

/** Master data (§13.2): any member reads; writes need master_data_admin or manager_approver (admins via satisfiesRole). */
@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@TenantBound()
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ApiResponse({
    status: 200,
    description: 'List all products',
    type: [Product],
  })
  findAll(): Promise<Product[]> {
    return this.productService.findAll();
  }

  @Get(':id')
  @ApiResponse({ status: 200, description: 'Get product by ID', type: Product })
  findOne(@Param('id') id: string): Promise<Product | null> {
    return this.productService.findOne(id);
  }

  @Post()
  @Roles('master_data_admin', 'manager_approver')
  @ApiBody({ type: CreateProductDto })
  @ApiResponse({ status: 201, description: 'Create product', type: Product })
  create(@Body() data: CreateProductDto): Promise<Product> {
    return this.productService.create(data);
  }

  @Put(':id')
  @Roles('master_data_admin', 'manager_approver')
  @ApiBody({ type: UpdateProductDto })
  @ApiResponse({ status: 200, description: 'Update product', type: Product })
  update(
    @Param('id') id: string,
    @Body() data: UpdateProductDto,
  ): Promise<Product | null> {
    return this.productService.update(id, data);
  }

  @Delete(':id')
  @Roles('master_data_admin', 'manager_approver')
  @ApiResponse({ status: 200, description: 'Delete product' })
  remove(@Param('id') id: string): Promise<void> {
    return this.productService.remove(id);
  }
}
