import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { HierarchyService } from './hierarchy.service';

@Module({
  imports: [PrismaModule],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
