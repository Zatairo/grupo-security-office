import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { HierarchyService } from '../../common/hierarchy/hierarchy.service';
import { AuditService } from '../audit/audit.service';
import { AccessContext } from '../../common/acl/acl.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('api/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly hierarchyService: HierarchyService,
    private readonly auditService: AuditService,
  ) {}

  private ctx(user: any): AccessContext {
    return { userId: user?.sub ?? user?.id, roles: user?.roles ?? [] };
  }

  @Get()
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Listar usuarios' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll({
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 50,
      search,
    });
  }

  @Get(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Obtener usuario por ID' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Crear usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(createUserDto, user?.sub ?? user?.id);
  }

  @Put(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Actualizar usuario' })
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() user: any,
  ) {
    return this.usersService.update(id, updateUserDto, user?.sub ?? user?.id);
  }

  @Delete(':id')
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Eliminar usuario' })
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.remove(id, user?.sub ?? user?.id);
  }

  @Patch(':id/supervisor')
  @Roles('Super Admin', 'Admin Comercial')
  @ApiOperation({ summary: 'Asignar supervisor a un usuario' })
  async setSupervisor(
    @Param('id') id: string,
    @Body() body: { supervisorId: string | null },
    @CurrentUser() user: any,
  ) {
    const ctx = this.ctx(user);
    await this.hierarchyService.assertCanSetSupervisor(id, body.supervisorId);
    
    const updated = await this.usersService.update(id, { supervisorId: body.supervisorId }, ctx.userId);
    
    await this.auditService.log({
      userId: ctx.userId,
      entity: 'User',
      entityId: id,
      action: 'update',
      newValues: { supervisorId: body.supervisorId },
    });
    
    return updated;
  }

  @Get('me/team')
  @ApiOperation({ summary: 'Obtener el equipo del usuario actual' })
  async getMyTeam(@CurrentUser() user: any) {
    const userId = user?.sub ?? user?.id;
    return this.hierarchyService.getTeamTree(userId);
  }
}
