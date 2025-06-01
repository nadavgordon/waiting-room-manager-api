import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Handles the root GET request.
   * This is a basic endpoint to confirm the API is running.
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
