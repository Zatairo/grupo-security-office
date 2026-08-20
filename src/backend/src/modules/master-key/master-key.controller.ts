import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MasterKeyService } from './master-key.service';
import { SetMasterKeyDto } from './dto/set-master-key.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccessContext } from '../../common/acl/acl.service';

@ApiTags('Seguridad')
@ApiBearerAuth()
@Controller('api/security/master-key')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MasterKeyController {
  constructor(private readonly masterKeyService: MasterKeyService) {}

  private ctx(user: any): AccessContext {
    return { userId: user?.sub ?? user?.id, roles: user?.roles ?? [] };
  }

  @Get()
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Estado de la clave maestra (nunca expone el hash)' })
  @ApiResponse({ status: 200, description: 'configured / updatedAt / updatedBy' })
  getStatus() {
    return this.masterKeyService.getStatus();
  }

  @Put()
  @Roles('Super Admin')
  @ApiOperation({ summary: 'Crear o actualizar la clave maestra (exige la actual si existe)' })
  @ApiResponse({ status: 200, description: 'Clave maestra configurada' })
  @ApiResponse({ status: 403, description: 'Clave maestra actual incorrecta' })
  set(@Body() dto: SetMasterKeyDto, @CurrentUser() user: any) {
    return this.masterKeyService.setMasterKey(dto, this.ctx(user));
  }

  @Delete()
  @Roles('Super Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Eliminar la clave maestra' })
  @ApiResponse({ status: 200, description: 'Clave maestra eliminada' })
  @ApiResponse({ status: 404, description: 'No hay clave configurada' })
  remove(@CurrentUser() user: any) {
    return this.masterKeyService.removeMasterKey(this.ctx(user));
  }
}