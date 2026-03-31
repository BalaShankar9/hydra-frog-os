import { Module } from '@nestjs/common';
import { DiffController } from './diff.controller';
import { DiffService } from './diff.service';
import { PrismaModule } from '../prisma';
import { OrgModule } from '../org';

@Module({
  imports: [PrismaModule, OrgModule],
  controllers: [DiffController],
  providers: [DiffService],
  exports: [DiffService],
})
export class DiffModule {}
