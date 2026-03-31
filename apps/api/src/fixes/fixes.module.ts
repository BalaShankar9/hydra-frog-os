import { Module } from '@nestjs/common';
import { FixesController } from './fixes.controller';
import { FixesService } from './fixes.service';
import { PrismaModule } from '../prisma';

@Module({
  imports: [PrismaModule],
  controllers: [FixesController],
  providers: [FixesService],
  exports: [FixesService],
})
export class FixesModule {}
