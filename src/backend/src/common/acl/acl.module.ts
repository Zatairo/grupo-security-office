import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AclService } from './acl.service';

@Module({
  imports: [PrismaModule],
  providers: [AclService],
  exports: [AclService],
})
export class AclModule {}
