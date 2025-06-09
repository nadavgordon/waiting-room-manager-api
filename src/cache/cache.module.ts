import { Module, OnModuleDestroy } from '@nestjs/common';
import { LoggerModule } from '../common/logger/logger.module';
import { CacheService } from './cache.service';

/**
 * Module responsible for managing cache connections and cleanup.
 * Implements OnModuleDestroy to ensure proper Redis connection cleanup
 * during application shutdown.
 */
@Module({
  imports: [LoggerModule],
  providers: [CacheService],
  exports: [CacheService],
})
export class CacheCleanupModule implements OnModuleDestroy {
  constructor(private readonly cacheService: CacheService) {}

  async onModuleDestroy() {
    // Ensure Redis connections are properly closed during shutdown
    await this.cacheService.onModuleDestroy();
  }
}
