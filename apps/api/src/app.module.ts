import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { OrgModule } from './org';
import { ProjectModule } from './project';
import { QueueModule } from './queue';
import { CrawlModule } from './crawl';
import { ScheduleModule } from './schedule';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    QueueModule,
    AuthModule,
    OrgModule,
    ProjectModule,
    CrawlModule,
    ScheduleModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
