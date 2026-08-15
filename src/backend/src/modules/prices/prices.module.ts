import { Module } from '@nestjs/common';
import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AclModule } from '../../common/acl/acl.module';

@Module({
  imports: [PrismaModule, AclModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
