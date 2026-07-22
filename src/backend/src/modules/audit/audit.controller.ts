import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('api/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Listar logs de auditoría' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.auditService.findAll({
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 50,
      entity,
      entityId,
      userId,
      action,
    });
  }

  @Get(':entity/:entityId')
  @Roles('Admin', 'Gerente')
  @ApiOperation({ summary: 'Obtener auditoría de una entidad específica' })
  findByEntity(
    @Param('entity') entity: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(entity, entityId);
  }
}
