import { Module } from '@nestjs/common';
import { MasterKeyService } from './master-key.service';
import { MasterKeyController } from './master-key.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [MasterKeyController],
  providers: [MasterKeyService],
  exports: [MasterKeyService],
})
export class MasterKeyModule {}