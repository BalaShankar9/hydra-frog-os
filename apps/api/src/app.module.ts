import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
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
import { TemplatesModule } from './templates';
import { DiffModule } from './diff';
import { PerfModule } from './perf';
import { FixesModule } from './fixes';
import { StudioModule } from './studio';
import { FlagModule } from './studio/flags';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    QueueModule,
    AuthModule,
    OrgModule,
    ProjectModule,
    CrawlModule,
    ScheduleModule,
    TemplatesModule,
    DiffModule,
    PerfModule,
    FixesModule,
    StudioModule,
    FlagModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
