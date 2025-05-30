import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /**
   * Provides a simple "Hello World!" message.
   * This service can be injected into controllers or other services.
   */
  getHello(): string {
    return 'Hello World!';
  }
}
