/**
 * @file health.module.ts
 * @description Module for application health checks using NestJS Terminus.
 */
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios'; // Terminus often uses HttpModule for http checks, good to have
import { HealthController } from './health.controller';
// import { TypeOrmModule } from '@nestjs/typeorm'; // Not strictly needed if default DataSource is used by TypeOrmHealthIndicator

@Module({
  imports: [
    TerminusModule,
    HttpModule, // Optional: if you plan to add HTTP health checks for external services
    // TypeOrmModule is not explicitly imported here as TypeOrmHealthIndicator
    // can often use the default DataSource. If issues arise with multiple
    // datasources or specific connection needs, it might be required.
  ],
  controllers: [HealthController],
})
export class HealthModule {}