import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ApiResponse } from '@hydra-frog-os/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): ApiResponse<{ message: string }> {
    return {
      success: true,
      data: { message: this.appService.getHello() },
    };
  }
}
