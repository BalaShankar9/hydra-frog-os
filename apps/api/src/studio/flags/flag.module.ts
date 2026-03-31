/**
 * Feature Flag Module
 */

import { Module } from '@nestjs/common';
import { FlagController } from './flag.controller';
import { FlagService } from './flag.service';
import { PrismaModule } from '../../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [FlagController],
  providers: [FlagService],
  exports: [FlagService],
})
export class FlagModule {}
