import { Module } from '@nestjs/common';
import { ListasService } from './listas.service';
import { ListasController } from './listas.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AclModule } from '../../common/acl/acl.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  controllers: [ListasController],
  imports: [PrismaModule, AclModule, AuditModule],
  providers: [ListasService],
  exports: [ListasService],
})
export class ListasModule {}