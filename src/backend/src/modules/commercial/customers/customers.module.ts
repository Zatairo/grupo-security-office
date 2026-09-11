import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { AclModule } from '../../../common/acl/acl.module';
import { HierarchyModule } from '../../../common/hierarchy/hierarchy.module';
import { AuditModule } from '../../audit/audit.module';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
  imports: [PrismaModule, AclModule, HierarchyModule, AuditModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
