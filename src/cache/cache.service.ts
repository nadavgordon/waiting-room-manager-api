import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Service responsible for managing Redis cache connections and ensuring proper cleanup
 * during application shutdown.
 * 
 * Implements OnModuleDestroy lifecycle hook to properly close Redis connections,
 * preventing resource leaks during application termination.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  /**
   * Gracefully closes Redis cache connections when the application is shutting down.
   * This prevents connection leaks and ensures that in-flight cache operations
   * can complete before termination.
   */
  async onModuleDestroy(): Promise<void> {
    // Add very visible logging for testing
    console.log('\n\n🔴 CACHE SERVICE: onModuleDestroy TRIGGERED - GRACEFUL SHUTDOWN IN PROGRESS');
    this.logger.log('CACHE SERVICE: Starting graceful shutdown of Redis connections');
    
    try {
      // Check if the cache manager has a close/quit method available
      // Different Redis client versions may have different methods
      const redisClient = (this.cacheManager as any).store?.client || 
                         (this.cacheManager as any).store?.getClient?.();
      
      if (redisClient) {
        if (typeof redisClient.quit === 'function') {
          await redisClient.quit();
          console.log('✅ REDIS CONNECTION CLOSED SUCCESSFULLY VIA quit()');
          this.logger.log('Redis connection closed successfully via quit()');
        } else if (typeof redisClient.disconnect === 'function') {
          await redisClient.disconnect();
          console.log('✅ REDIS CONNECTION CLOSED SUCCESSFULLY VIA disconnect()');
          this.logger.log('Redis connection closed successfully via disconnect()');
        } else if (typeof redisClient.close === 'function') {
          await redisClient.close();
          console.log('✅ REDIS CONNECTION CLOSED SUCCESSFULLY VIA close()');
          this.logger.log('Redis connection closed successfully via close()');
        } else {
          console.log('⚠️ WARNING: COULD NOT FIND METHOD TO CLOSE REDIS CONNECTION');
          this.logger.warn('Could not find an appropriate method to close Redis connection');
        }
      } else {
        console.log('⚠️ WARNING: COULD NOT ACCESS REDIS CLIENT');
        this.logger.warn('Could not access Redis client for proper connection closure');
      }
    } catch (error) {
      console.error('❌ ERROR CLOSING REDIS CONNECTION', error);
      this.logger.error(
        'Error closing Redis connection',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
