import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { LoggerService } from '../common/logger/logger.service';

/**
 * Service responsible for managing Redis cache connections and ensuring proper cleanup
 * during application shutdown.
 * 
 * Implements OnModuleDestroy lifecycle hook to properly close Redis connections,
 * preventing resource leaks during application termination.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly logger: LoggerService
  ) {}

  /**
   * Gets an item from cache with the given key
   * @param key The cache key
   * @returns The cached value or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const value = await this.cacheManager.get<T>(key);
      return value === null ? undefined : value;
    } catch (error) {
      this.logger.error(
        `Error retrieving key '${key}' from cache`,
        error instanceof Error ? error.stack : String(error),
        'CacheService'
      );
      return undefined;
    }
  }

  /**
   * Sets an item in cache with the given key
   * @param key The cache key
   * @param value The value to cache
   * @param ttl Optional TTL in milliseconds
   */
  async set<T>(key: string, value: T, ttl: number = 60000): Promise<void> {
    try {
      await this.cacheManager.set(key, value, ttl);
      this.logger.debug(`Set cache key: ${key}${ttl ? ` with TTL ${ttl}ms` : ''}`, 'CacheService');
    } catch (error) {
      this.logger.error(
        `Error setting key '${key}' in cache`,
        error instanceof Error ? error.stack : String(error),
        'CacheService'
      );
    }
  }

  /**
   * Deletes an item from cache with the given key
   * @param key The cache key to delete
   */
  async del(key: string): Promise<void> {
    try {
      await this.cacheManager.del(key);
      this.logger.debug(`Deleted cache key: ${key}`, 'CacheService');
    } catch (error) {
      this.logger.error(
        `Error deleting key '${key}' from cache`,
        error instanceof Error ? error.stack : String(error),
        'CacheService'
      );
    }
  }

  /**
   * Deletes multiple items from cache with pattern matching
   * Common patterns:
   * - Prefix match: `room_*` for all room keys
   * - Entity type: `user:*` for all user-related keys
   * 
   * @param pattern The pattern to match for deletion
   */
  async delByPattern(pattern: string): Promise<void> {
    try {
      // First, try to use store.keys which is more standard and what our tests expect
      if ((this.cacheManager as any).store?.keys) {
        try {
          const keys: string[] = await (this.cacheManager as any).store.keys();
          
          // Extract the base pattern without wildcard for matching
          const patternBase = pattern.replace(/\*+$/, '');
          const matchingKeys = keys.filter(key => key.startsWith(patternBase));
          
          if (matchingKeys.length > 0) {
            // Process keys one by one to better handle errors
            for (const key of matchingKeys) {
              try {
                await this.cacheManager.del(key);
              } catch (keyError) {
                // Log the error but don't propagate it (matching test expectations)
                this.logger.error(
                  `Error deleting key '${key}' from cache`,
                  keyError instanceof Error ? keyError.stack : String(keyError),
                  'CacheService'
                );
              }
            }
            this.logger.debug(`Processed ${matchingKeys.length} keys matching pattern: ${pattern}`, 'CacheService');
          }
        } catch (keysError) {
          // Log the error but don't propagate it (matching test expectations)
          this.logger.error(
            `Error retrieving keys for pattern '${pattern}' from cache`,
            keysError instanceof Error ? keysError.stack : String(keysError),
            'CacheService'
          );
        }
      } 
      // Fallback to using the Redis client directly if store.keys is not available
      else {
        try {
          const redisClient = (this.cacheManager as any).store?.client || 
                            (this.cacheManager as any).store?.getClient?.();
          
          if (redisClient && typeof redisClient.keys === 'function') {
            const keys: string[] = await redisClient.keys(pattern);
            if (keys.length > 0) {
              // Process keys one by one to better handle errors
              for (const key of keys) {
                try {
                  await this.cacheManager.del(key);
                } catch (keyError) {
                  // Log the error but don't propagate it (matching test expectations)
                  this.logger.error(
                    `Error deleting key '${key}' from cache`,
                    keyError instanceof Error ? keyError.stack : String(keyError),
                    'CacheService'
                  );
                }
              }
              this.logger.debug(`Processed ${keys.length} keys matching pattern: ${pattern}`, 'CacheService');
            }
          } else {
            this.logger.warn(`Unable to delete by pattern: Redis client not accessible`, 'CacheService');
          }
        } catch (redisError) {
          // Log the error but don't propagate it (matching test expectations)
          this.logger.error(
            `Error accessing Redis client for pattern '${pattern}'`,
            redisError instanceof Error ? redisError.stack : String(redisError),
            'CacheService'
          );
        }
      }
    } catch (error) {
      // Catch-all for any unexpected errors
      this.logger.error(
        `Unexpected error deleting keys matching pattern '${pattern}' from cache`,
        error instanceof Error ? error.stack : String(error),
        'CacheService'
      );
    }
  }

  /**
   * Gracefully closes Redis cache connections when the application is shutting down.
   * This prevents connection leaks and ensures that in-flight cache operations
   * can complete before termination.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Starting graceful shutdown of Redis connections', 'CacheService');
    
    try {
      // Check if the cache manager has a close/quit method available
      // Different Redis client versions may have different methods
      const redisClient = (this.cacheManager as any).store?.client || 
                         (this.cacheManager as any).store?.getClient?.();
      
      if (redisClient) {
        if (typeof redisClient.quit === 'function') {
          await redisClient.quit();
          this.logger.log('Redis connection closed successfully via quit()', 'CacheService');
        } else if (typeof redisClient.disconnect === 'function') {
          await redisClient.disconnect();
          this.logger.log('Redis connection closed successfully via disconnect()', 'CacheService');
        } else if (typeof redisClient.close === 'function') {
          await redisClient.close();
          this.logger.log('Redis connection closed successfully via close()', 'CacheService');
        } else {
          this.logger.warn('Could not find an appropriate method to close Redis connection', 'CacheService');
        }
      } else {
        this.logger.warn('Could not access Redis client for proper connection closure', 'CacheService');
      }
    } catch (error) {
      this.logger.error(
        'Error closing Redis connection',
        error instanceof Error ? error.stack : String(error),
        'CacheService'
      );
    }
  }
}
