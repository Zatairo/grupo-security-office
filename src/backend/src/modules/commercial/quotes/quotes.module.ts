import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AclModule } from '../../../common/acl/acl.module';
import { HierarchyModule } from '../../../common/hierarchy/hierarchy.module';
import { AuditModule } from '../../audit/audit.module';
import { QuotesService } from './quotes.service';
import { QuotesController } from './quotes.controller';

@Module({
  imports: [PrismaModule, AclModule, HierarchyModule, AuditModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
