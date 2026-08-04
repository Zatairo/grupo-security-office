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
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
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
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Crear producto' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar producto' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/toggle-visibility')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Alternar visibilidad del producto' })
  toggleVisibility(@Param('id') id: string) {
    return this.productsService.toggleVisibility(id);
  }

  @Patch(':id/toggle-active')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Alternar estado activo del producto' })
  toggleActive(@Param('id') id: string) {
    return this.productsService.toggleActive(id);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Eliminar producto' })
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Post('import')
  @Roles('Super Admin', 'Admin Comercial')
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

  @Post(':id/images')
  @Roles('Super Admin', 'Admin Comercial')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Subir imagen de producto' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        isPrimary: { type: 'string', description: "'true' | 'false'", default: 'false' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Imagen subida' })
  @ApiResponse({ status: 400, description: 'Archivo inválido o excede 8MB' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('isPrimary') isPrimary?: string,
  ) {
    return this.productsService.uploadImage(id, file, isPrimary === 'true');
  }

  @Delete('images/:imageId')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Eliminar imagen de producto' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  removeImage(@Param('imageId') imageId: string) {
    return this.productsService.deleteImage(imageId);
  }
}
