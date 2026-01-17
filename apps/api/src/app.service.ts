import { Injectable } from '@nestjs/common';
import { APP_NAME } from '@hydra-frog-os/shared';

@Injectable()
export class AppService {
  getHello(): string {
    return `Welcome to ${APP_NAME} API`;
  }
}
