import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, UploadedFile, UseInterceptors, GoneException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PublishProductDto } from './dto/publish-product.dto';
import { UnpublishProductDto } from './dto/unpublish-product.dto';
import { TransitionProductDto } from './dto/transition.dto';
import { BulkTransitionProductDto } from './dto/bulk-transition.dto';
import { DeleteProductDto } from './dto/delete-product.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AccessContext } from '../../common/acl/acl.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('api/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private ctx(user: any): AccessContext {
    return { userId: user?.sub ?? user?.id, roles: user?.roles ?? [] };
  }

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

  @Get('publish-scheduled')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Listar productos programados para publicación' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Inicio del rango (ISO). Default: ahora.' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'Fin del rango (ISO). Default: ahora + 7 días.' })
  findPublishScheduled(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.productsService.findPublishScheduled(from, to);
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
    @CurrentUser() user: any,
  ) {
    return this.productsService.findAll({
      skip: query.skip ?? 0,
      take: query.take ?? 50,
      search: query.search,
      categoryId: query.categoryId,
      brandId: query.brandId,
      isVisible: query.isVisible,
      isActive: query.isActive,
    }, this.ctx(user));
  }

  @Get(':id')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.findOne(id, this.ctx(user));
  }

  @Post()
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Crear producto' })
  @ApiResponse({ status: 201, description: 'Producto creado' })
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, this.ctx(user));
  }

  @Put(':id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar producto' })
  update(@Param('id') id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    return this.productsService.update(id, dto, this.ctx(user));
  }

  @Patch(':id/toggle-visibility')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Obsoleto', deprecated: true, description: 'Adaptador legacy: DRAFT→PUBLISH, PUBLISHED→UNPUBLISH, ARCHIVED→400. No produce HIDDEN. Marcar reemplazado por POST /transition.' })
  toggleVisibility(@Param('id') id: string, @CurrentUser() user: any) {
    return this.productsService.toggleVisibility(id, this.ctx(user));
  }

  @Patch(':id/toggle-active')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Eliminado', deprecated: true, description: 'Obsoleto: devuelve 410 Gone sin modificar el producto. Usa ARCHIVE o RESTORE vía POST /transition o POST /bulk-transition.' })
  toggleActive(@Param('id') _id: string) {
    throw new GoneException('toggle-active está obsoleto. Usa la transición canónica ARCHIVE o RESTORE.');
  }

  @Patch(':id/publish')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial')
  @ApiOperation({ summary: 'Publicar o programar publicación de un producto (obsoleto)', deprecated: true, description: 'Sin publishAt futura: PUBLISH (DRAFT→PUBLISHED). Con publishAt futura: persiste programación sobre DRAFT (el scheduler aplicará PUBLISH). unpublishAt se ignora. Reemplazado por POST /transition.' })
  @ApiResponse({ status: 200, description: 'Producto publicado o programado' })
  @ApiResponse({ status: 400, description: 'Requisitos previos a publicación no cumplidos (detalle)' })
  @ApiResponse({ status: 409, description: 'El producto ya está publicado' })
  publish(
    @Param('id') id: string,
    @Body() dto: PublishProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.publish(id, dto, this.ctx(user));
  }

  @Patch(':id/unpublish')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial')
  @ApiOperation({ summary: 'Despublicar un producto (obsoleto)', deprecated: true, description: 'Ejecuta UNPUBLISH (PUBLISHED→DRAFT). Acepta reason opcional para auditoría. Reemplazado por POST /transition.' })
  @ApiResponse({ status: 200, description: 'Producto despublicado' })
  @ApiResponse({ status: 400, description: 'Motivo inválido' })
  unpublish(
    @Param('id') id: string,
    @Body() dto: UnpublishProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.unpublish(id, dto, this.ctx(user));
  }

  @Post(':id/transition')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Transición canónica de ciclo de vida de un producto (PUBLISH, UNPUBLISH, ARCHIVE, RESTORE)' })
  @ApiResponse({ status: 200, description: 'Transición aplicada. Devuelve el producto con allowedActions.' })
  @ApiResponse({ status: 400, description: 'Transición inválida, motivo/confirm/publishAt faltante o checklist de publicación incumplido.' })
  @ApiResponse({ status: 403, description: 'Sin permisos RBAC o nivel ACL insuficiente.' })
  transition(
    @Param('id') id: string,
    @Body() dto: TransitionProductDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.transition(id, dto, this.ctx(user));
  }

  @Post('bulk-transition')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Aplicar un evento FSM a varios productos (1..500). Procesa producto a producto; devuelve applied y rejected.' })
  @ApiResponse({ status: 201, description: 'Procesado. Respuesta: { data: { applied, rejected } }.' })
  bulkTransition(
    @Body() dto: BulkTransitionProductDto,
    @CurrentUser() user: any,
  ) {
    const { ids, event, reason, publishAt, unpublishAt, confirm } = dto;
    return this.productsService.bulkTransition(
      ids,
      { event, reason, publishAt, unpublishAt, confirm },
      this.ctx(user),
    );
  }

  @Delete(':id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Eliminar producto físicamente. Exige confirm: true; si el producto tiene datos asociados, exige masterKey (409 si falta, 403 si es incorrecta).' })
  @ApiResponse({ status: 200, description: 'Producto eliminado exitosamente' })
  @ApiResponse({ status: 400, description: 'Falta confirm: true' })
  @ApiResponse({ status: 403, description: 'Rol sin permiso, ACL sin manage o clave maestra incorrecta' })
  @ApiResponse({ status: 409, description: 'El producto tiene datos asociados y no se envió masterKey' })
  remove(@Param('id') id: string, @Body() dto: DeleteProductDto, @CurrentUser() user: any) {
    return this.productsService.remove(id, dto, this.ctx(user));
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
    @CurrentUser() user: any,
    @Body('isPrimary') isPrimary?: string,
  ) {
    return this.productsService.uploadImage(id, file, isPrimary === 'true', this.ctx(user));
  }

  @Delete('images/:imageId')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Eliminar imagen de producto' })
  @ApiResponse({ status: 200, description: 'Imagen eliminada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  removeImage(@Param('imageId') imageId: string, @CurrentUser() user: any) {
    return this.productsService.deleteImage(imageId, this.ctx(user));
  }

  @Patch('images/:imageId')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar imagen de producto (alt y/o principal)' })
  @ApiResponse({ status: 200, description: 'Imagen actualizada' })
  @ApiResponse({ status: 404, description: 'Imagen no encontrada' })
  updateImage(
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
    @CurrentUser() user: any,
  ) {
    return this.productsService.updateImage(imageId, dto, this.ctx(user));
  }
}
