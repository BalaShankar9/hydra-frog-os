import { Module } from '@nestjs/common';
import { CrawlController } from './crawl.controller';
import { CrawlService } from './crawl.service';
import { CrawlDataService } from './crawl-data.service';
import { PrismaModule } from '../prisma';
import { OrgModule } from '../org';
import { QueueModule } from '../queue';

@Module({
  imports: [PrismaModule, OrgModule, QueueModule],
  controllers: [CrawlController],
  providers: [CrawlService, CrawlDataService],
  exports: [CrawlService, CrawlDataService],
})
export class CrawlModule {}
