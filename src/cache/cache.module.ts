import { Module, OnModuleDestroy } from '@nestjs/common';
import { CacheService } from './cache.service';

/**
 * Module responsible for managing cache connections and cleanup.
 * Implements OnModuleDestroy to ensure proper Redis connection cleanup
 * during application shutdown.
 */
@Module({
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
