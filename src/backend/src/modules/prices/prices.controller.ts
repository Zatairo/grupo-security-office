import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PricesService } from './prices.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Price Lists')
@ApiBearerAuth()
@Controller('api/prices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get('lists')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Listar listas de precios' })
  findAllPriceLists() {
    return this.pricesService.findAllPriceLists();
  }

  @Get('lists/:id')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener lista de precios por ID' })
  findOnePriceList(@Param('id') id: string) {
    return this.pricesService.findOnePriceList(id);
  }

  @Post('lists')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Crear lista de precios' })
  @ApiResponse({ status: 201, description: 'Lista creada' })
  createPriceList(@Body() dto: CreatePriceListDto) {
    return this.pricesService.createPriceList(dto);
  }

  @Put('lists/:id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar lista de precios' })
  updatePriceList(@Param('id') id: string, @Body() dto: Partial<CreatePriceListDto>) {
    return this.pricesService.updatePriceList(id, dto);
  }

  @Patch('lists/:id/toggle-active')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Alternar estado activo de la lista de precios' })
  @ApiResponse({ status: 200, description: 'Lista actualizada' })
  togglePriceListActive(@Param('id') id: string) {
    return this.pricesService.togglePriceListActive(id);
  }

  @Delete('lists/:id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Eliminar lista de precios' })
  removePriceList(@Param('id') id: string) {
    return this.pricesService.removePriceList(id);
  }

  @Get('product/:productId')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener precios de un producto' })
  findPricesByProduct(@Param('productId') productId: string) {
    return this.pricesService.findPricesByProduct(productId);
  }

  @Get('list/:priceListId')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener precios de una lista' })
  findPricesByPriceList(@Param('priceListId') priceListId: string) {
    return this.pricesService.findPricesByPriceList(priceListId);
  }

  @Post()
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Crear precio' })
  @ApiResponse({ status: 201, description: 'Precio creado' })
  createPrice(@Body() dto: CreatePriceDto) {
    return this.pricesService.createPrice(dto);
  }

  @Put(':id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar precio' })
  updatePrice(@Param('id') id: string, @Body() dto: UpdatePriceDto) {
    return this.pricesService.updatePrice(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Eliminar precio' })
  removePrice(@Param('id') id: string) {
    return this.pricesService.removePrice(id);
  }
}
