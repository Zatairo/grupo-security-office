import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Listar productos' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'brandId', required: false, type: String })
  @ApiQuery({ name: 'isVisible', required: false, type: Boolean })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('brandId') brandId?: string,
    @Query('isVisible') isVisible?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.productsService.findAll({
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 50,
      search,
      categoryId,
      brandId,
      isVisible: isVisible !== undefined ? isVisible === 'true' : undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Crear producto' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Actualizar producto' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/toggle-visibility')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Alternar visibilidad del producto' })
  toggleVisibility(@Param('id') id: string) {
    return this.productsService.toggleVisibility(id);
  }

  @Patch(':id/toggle-active')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Alternar estado activo del producto' })
  toggleActive(@Param('id') id: string) {
    return this.productsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Eliminar producto' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
