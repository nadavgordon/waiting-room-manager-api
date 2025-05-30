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

  /**
   * Health check endpoint for readiness probes.
   * Used by orchestrators (e.g., Kubernetes) to determine if the application is ready to accept traffic.
   * A successful response indicates the application has started and is ready.
   */
  @Get('/health/ready')
  getReadiness(): string {
    return 'OK';
  }

  /**
   * Health check endpoint for liveness probes.
   * Used by orchestrators (e.g., Kubernetes) to determine if the application is still running and healthy.
   * A successful response indicates the application is alive and responsive.
   */
  @Get('/health/live')
  getLiveness(): string {
    return 'OK';
  }
}
