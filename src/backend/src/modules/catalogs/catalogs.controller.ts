import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogsService } from './catalogs.service';
import { CreateCatalogDto } from './dto/create-catalog.dto';
import { UpdateCatalogDto } from './dto/update-catalog.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Catalogs')
@ApiBearerAuth()
@Controller('api/catalogs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get('mine')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Listar catálogos activos' })
  findMine(@CurrentUser() user: any) {
    return this.catalogsService.findMine(user?.sub ?? user?.id, user?.roles ?? []);
  }

  @Get()
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Listar catálogos' })
  findAll(@CurrentUser() user: any) {
    return this.catalogsService.findAll(user?.sub ?? user?.id, user?.roles ?? []);
  }

  @Get(':id')
  @Roles('Super Admin', 'Supervisor', 'Admin Comercial', 'Operador', 'Consulta')
  @ApiOperation({ summary: 'Obtener catálogo por ID con conteo de productos' })
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.catalogsService.findOne(id, user?.sub ?? user?.id, user?.roles ?? []);
  }

  @Post()
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Crear catálogo' })
  @ApiResponse({ status: 201, description: 'Catálogo creado' })
  @ApiResponse({ status: 409, description: 'Ya existe un catálogo con ese código' })
  create(@Body() dto: CreateCatalogDto) {
    return this.catalogsService.create(dto);
  }

  @Patch(':id')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Actualizar catálogo' })
  update(@Param('id') id: string, @Body() dto: UpdateCatalogDto) {
    return this.catalogsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar catálogo' })
  @ApiResponse({ status: 204, description: 'Catálogo eliminado' })
  @ApiResponse({ status: 409, description: 'No se puede eliminar un catálogo con productos' })
  remove(@Param('id') id: string) {
    return this.catalogsService.remove(id);
  }
}
