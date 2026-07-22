import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
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
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Listar listas de precios' })
  findAllPriceLists() {
    return this.pricesService.findAllPriceLists();
  }

  @Get('lists/:id')
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Obtener lista de precios por ID' })
  findOnePriceList(@Param('id') id: string) {
    return this.pricesService.findOnePriceList(id);
  }

  @Post('lists')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Crear lista de precios' })
  @ApiResponse({ status: 201, description: 'Lista creada' })
  createPriceList(@Body() dto: CreatePriceListDto) {
    return this.pricesService.createPriceList(dto);
  }

  @Put('lists/:id')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Actualizar lista de precios' })
  updatePriceList(@Param('id') id: string, @Body() dto: Partial<CreatePriceListDto>) {
    return this.pricesService.updatePriceList(id, dto);
  }

  @Delete('lists/:id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Eliminar lista de precios' })
  removePriceList(@Param('id') id: string) {
    return this.pricesService.removePriceList(id);
  }

  @Get('product/:productId')
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Obtener precios de un producto' })
  findPricesByProduct(@Param('productId') productId: string) {
    return this.pricesService.findPricesByProduct(productId);
  }

  @Get('list/:priceListId')
  @Roles('Admin', 'Gerente', 'Operator', 'Viewer')
  @ApiOperation({ summary: 'Obtener precios de una lista' })
  findPricesByPriceList(@Param('priceListId') priceListId: string) {
    return this.pricesService.findPricesByPriceList(priceListId);
  }

  @Post()
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Crear precio' })
  @ApiResponse({ status: 201, description: 'Precio creado' })
  createPrice(@Body() dto: CreatePriceDto) {
    return this.pricesService.createPrice(dto);
  }

  @Put(':id')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Actualizar precio' })
  updatePrice(@Param('id') id: string, @Body() dto: UpdatePriceDto) {
    return this.pricesService.updatePrice(id, dto);
  }

  @Delete(':id')
  @Roles('Admin')
  @ApiOperation({ summary: 'Eliminar precio' })
  removePrice(@Param('id') id: string) {
    return this.pricesService.removePrice(id);
  }
}
