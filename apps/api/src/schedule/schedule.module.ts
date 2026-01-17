import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { ScheduleController } from './schedule.controller';
import { ScheduleService } from './schedule.service';
import { SchedulerService } from './scheduler.service';
import { PrismaModule } from '../prisma';
import { OrgModule } from '../org';
import { CrawlModule } from '../crawl';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    PrismaModule,
    OrgModule,
    forwardRef(() => CrawlModule),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleService, SchedulerService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
