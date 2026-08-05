import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('api/assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Get()
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Listar asignaciones (filtros: userId, resourceType)' })
  findAll(
    @Query('userId') userId?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    return this.assignmentsService.findAll({ userId, resourceType });
  }

  @Post()
  @Roles('Super Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear o reactivar una asignación' })
  @ApiResponse({ status: 201, description: 'Asignación creada o reactivada' })
  @ApiResponse({ status: 404, description: 'Usuario o recurso no existe' })
  @ApiResponse({ status: 409, description: 'Ya existe una asignación activa' })
  create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Patch(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Actualizar level y/o isActive de una asignación' })
  update(@Param('id') id: string, @Body() dto: UpdateAssignmentDto) {
    return this.assignmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar lógicamente una asignación' })
  @ApiResponse({ status: 204, description: 'Asignación desactivada' })
  async remove(@Param('id') id: string) {
    await this.assignmentsService.remove(id);
  }
}
