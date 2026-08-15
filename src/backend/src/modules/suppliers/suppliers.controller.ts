import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import { CreateStockDto } from './dto/create-stock.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { UpdatePurchaseOrderStatusDto } from './dto/update-purchase-order-status.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccessContext } from '../../common/acl/acl.service';

const READ_ROLES = ['Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta'];
const WRITE_ROLES = ['Super Admin', 'Admin Comercial'];

@ApiTags('Proveedores')
@ApiBearerAuth()
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  private ctx(user: any): AccessContext {
    return { userId: user?.sub ?? user?.id, roles: user?.roles ?? [] };
  }

  // ============================== Suppliers ==============================

  @Get('suppliers')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Listar proveedores (filtros search/status; incluye evaluationCount)' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAll(@Query('search') search?: string, @Query('status') status?: string) {
    return this.suppliersService.findAllSuppliers({ search, status });
  }

  @Get('suppliers/:id')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Detalle de un proveedor' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOneSupplier(id);
  }

  @Post('suppliers')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear proveedor (nit único)' })
  @ApiResponse({ status: 201, description: 'Proveedor creado' })
  @ApiResponse({ status: 409, description: 'NIT duplicado' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: any) {
    return this.suppliersService.createSupplier(dto, this.ctx(user));
  }

  @Put('suppliers/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Actualizar proveedor (parcial)' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierDto, @CurrentUser() user: any) {
    return this.suppliersService.updateSupplier(id, dto, this.ctx(user));
  }

  @Delete('suppliers/:id')
  @Roles('Super Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar proveedor (409 si tiene órdenes de compra)' })
  @ApiResponse({ status: 200, description: 'Proveedor eliminado' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  @ApiResponse({ status: 409, description: 'Tiene órdenes de compra asociadas' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.removeSupplier(id, this.ctx(user));
  }

  // ============================ Evaluaciones ============================

  @Get('suppliers/:id/evaluations')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Evaluaciones de un proveedor (incluye evaluador)' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  findEvaluations(@Param('id') id: string) {
    return this.suppliersService.findEvaluations(id);
  }

  @Post('suppliers/:id/evaluations')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear evaluación de proveedor (evaluador = actor)' })
  @ApiResponse({ status: 201, description: 'Evaluación creada' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  createEvaluation(
    @Param('id') id: string,
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.createEvaluation(id, dto, this.ctx(user));
  }

  // ================================ Stock ================================

  @Get('products/:productId/stock')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Stock de un producto' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  findStock(@Param('productId') productId: string) {
    return this.suppliersService.findStockByProduct(productId);
  }

  @Post('products/:productId/stock')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear o actualizar (upsert por productId) el stock de un producto' })
  @ApiResponse({ status: 201, description: 'Stock creado o actualizado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  upsertStock(
    @Param('productId') productId: string,
    @Body() dto: CreateStockDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.upsertStock(productId, dto, this.ctx(user));
  }

  @Patch('stock/:id')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Actualizar stock (parcial)' })
  @ApiResponse({ status: 404, description: 'Stock no encontrado' })
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto, @CurrentUser() user: any) {
    return this.suppliersService.updateStock(id, dto, this.ctx(user));
  }

  @Delete('stock/:id')
  @Roles('Super Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar registro de stock' })
  @ApiResponse({ status: 200, description: 'Stock eliminado' })
  @ApiResponse({ status: 404, description: 'Stock no encontrado' })
  removeStock(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.removeStock(id, this.ctx(user));
  }

  // ============================ Órdenes de compra ============================

  @Get('purchase-orders')
  @Roles(...READ_ROLES)
  @ApiOperation({ summary: 'Listar órdenes de compra (filtro status; incluye proveedor)' })
  @ApiQuery({ name: 'status', required: false })
  findPurchaseOrders(@Query('status') status?: string) {
    return this.suppliersService.findPurchaseOrders({ status });
  }

  @Post('purchase-orders')
  @Roles(...WRITE_ROLES)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear orden de compra (status default solicitada)' })
  @ApiResponse({ status: 201, description: 'Orden creada' })
  @ApiResponse({ status: 404, description: 'Proveedor no encontrado' })
  createPurchaseOrder(@Body() dto: CreatePurchaseOrderDto, @CurrentUser() user: any) {
    return this.suppliersService.createPurchaseOrder(dto, this.ctx(user));
  }

  @Patch('purchase-orders/:id/status')
  @Roles(...WRITE_ROLES)
  @ApiOperation({ summary: 'Actualizar estado de una orden de compra' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  updatePurchaseOrderStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.suppliersService.updatePurchaseOrderStatus(id, dto, this.ctx(user));
  }

  @Delete('purchase-orders/:id')
  @Roles('Super Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar orden de compra' })
  @ApiResponse({ status: 200, description: 'Orden eliminada' })
  @ApiResponse({ status: 404, description: 'Orden no encontrada' })
  removePurchaseOrder(@Param('id') id: string, @CurrentUser() user: any) {
    return this.suppliersService.removePurchaseOrder(id, this.ctx(user));
  }
}