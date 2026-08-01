import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('trending')
  @Public()
  @ApiOperation({ summary: 'Obtener productos tendencia' })
  findTrending(
    @Query('take') take?: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string
  ) {
    return this.productsService.findTrending({ take, categoryId, search });
  }

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
    @Query() query: ProductQueryDto,
  ) {
    return this.productsService.findAll({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      search: query.search,
      categoryId: query.categoryId,
      brandId: query.brandId,
      isVisible: query.isVisible,
      isActive: query.isActive,
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

  @Post('import')
  @Roles('Admin', 'Gerente')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Importar productos desde Excel' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Productos importados' })
  @ApiResponse({ status: 400, description: 'Archivo inválido' })
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    return this.productsService.importFromExcel(file.buffer);
  }
}
