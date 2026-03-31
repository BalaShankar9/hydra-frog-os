import { Module } from '@nestjs/common';
import { PerfController } from './perf.controller';
import { PerfService } from './perf.service';
import { PrismaModule } from '../prisma';
import { OrgModule } from '../org';

@Module({
  imports: [PrismaModule, OrgModule],
  controllers: [PerfController],
  providers: [PerfService],
  exports: [PerfService],
})
export class PerfModule {}
