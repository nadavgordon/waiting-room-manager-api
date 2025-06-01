/**
 * @file health.controller.ts
 * @description Controller for handling application health checks.
 * Integrates with NestJS Terminus to provide liveness and readiness probes.
 */
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  TypeOrmHealthIndicator,
  HealthCheck,
  HealthCheckResult,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('Health')
@Controller('health')
@SkipThrottle() // Exempt health check endpoints from rate limiting
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
  ) {}

  /**
   * Liveness probe.
   * Checks if the application process is running.
   * @returns {Promise<HealthCheckResult>} Health check result.
   */
  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe for the application.' })
  @ApiResponse({ status: 200, description: 'Application is live.' })
  @ApiResponse({ status: 503, description: 'Application is not live.' })
  checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([]); // Basic liveness, no specific checks needed here
  }

  /**
   * Readiness probe.
   * Checks if the application is ready to serve traffic, including database connectivity.
   * @returns {Promise<HealthCheckResult>} Health check result.
   */
  @Get('ready')
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe for the application.',
    description: 'Checks if the application and its critical dependencies (e.g., database) are ready.',
  })
  @ApiResponse({ status: 200, description: 'Application is ready.' })
  @ApiResponse({ status: 503, description: 'Application is not ready.' })
  checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => this.db.pingCheck('database', { timeout: 3000 }), // Check PostgreSQL connection
    ]);
  }
}