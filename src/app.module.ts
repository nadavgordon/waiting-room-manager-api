import { Module, Logger, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { AppService } from './app.service';
import { WaitingRoomModule } from './waiting-room/waiting-room.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { User } from './user/entities/user.entity';
import { RoomPlayer } from './waiting-room/entities/room-player.entity';
import { Room } from './waiting-room/entities/room.entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from './common/logger/logger.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TestLoggingModule } from './test-logging/test-logging.module';
import { HealthModule } from './health/health.module'; // Import HealthModule
import { DatabaseModule } from './db/database.module'; // Import DatabaseModule for graceful shutdown
import { CacheCleanupModule } from './cache/cache.module'; // Import CacheCleanupModule for graceful shutdown

@Module({
  imports: [
    // ConfigModule: Centralized configuration management.
    // It loads environment variables from .env files and makes them accessible throughout the application.
    // `isGlobal: true` ensures that ConfigService is available in any module without explicit import.
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    // TypeOrmModule.forRootAsync: Asynchronous database connection setup using TypeORM.
    // This allows injecting `ConfigService` to dynamically retrieve database credentials.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [Room, User, RoomPlayer], // Defines which entities are managed by this TypeORM connection.
        synchronize: false, // Crucial for production: prevents automatic schema synchronization. Migrations are used instead.
        migrations: ['dist/db/migrations/*.js'], // Path to database migration files for schema evolution.
      }),
      inject: [ConfigService],
    }),
    // Feature Modules: Encapsulate domain-specific logic and provide services/controllers.
    WaitingRoomModule, // Manages waiting room functionalities, including real-time interactions.
    UserModule, // Handles user data management.
    AuthModule, // Provides authentication and authorization services (JWT, Passport.js).
    LoggerModule, // Integrates a custom structured logging solution (Winston).
    TestLoggingModule, // Provides endpoints for testing logging security features.
    // CacheModule.registerAsync: Configures Redis as the application's caching layer.
    // `isGlobal: true` makes the cache manager accessible application-wide.
    // CacheModule.registerAsync: Configures Redis as the application's caching layer with enhanced resilience.
    // Implements retry strategy, connection timeouts, and reconnection logic.
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): Record<string, any> => {
        // Get application logger for Redis connection events
        const logger = new Logger('RedisCacheModule');
        
        return {
          store: redisStore,
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: (() => {
            const redisPassword = configService.get<string>('REDIS_PASSWORD');
            if (process.env.NODE_ENV === 'production' && !redisPassword) {
              throw new Error(
                'REDIS_PASSWORD must be set in production environment.',
              );
            }
            return redisPassword || undefined;
          })(),
          ttl: (configService.get<number>('REDIS_TTL') || 3600) * 1000, // Cache TTL in milliseconds
          
          // Connection resilience configuration
          // Set connection timeout (in ms)
          connectTimeout: configService.get<number>('REDIS_CONNECT_TIMEOUT') || 5000,
          
          // Retry strategy for handling connection failures
          // options contains: error, totalRetryTime, attempt
          retryStrategy: (options: any) => {
            // Log retry attempts
            logger.warn(
              `Redis connection attempt ${options.attempt} failed. Total retry time: ${options.totalRetryTime}ms`,
              options.error?.message,
            );
            
            // Stop retrying after 30 seconds of failures
            if (options.totalRetryTime > 30000) {
              logger.error('Redis connection failed after maximum retry time', options.error);
              return undefined; // Stop retrying
            }
            
            // Maximum retry attempts (10)
            if (options.attempt > 10) {
              logger.error('Redis connection failed after maximum attempts', options.error);
              return undefined; // Stop retrying
            }
            
            // Custom error handling
            if (options.error && options.error.code === 'ECONNREFUSED') {
              logger.warn('Redis connection refused. Retrying...');
            }
            
            // Exponential backoff with jitter for retry delay
            // Base: 200ms, multiplier: 2, max: 3000ms, with random jitter
            const baseDelay = 200;
            const multiplier = 2;
            const maxDelay = 3000;
            const attempt = Math.min(options.attempt, 10); // Cap at 10 for calculation
            
            // Calculate delay with exponential backoff
            const delay = Math.min(baseDelay * Math.pow(multiplier, attempt), maxDelay);
            
            // Add jitter (±20% randomization)
            const jitter = delay * 0.2 * (Math.random() - 0.5) * 2;
            const finalDelay = Math.floor(delay + jitter);
            
            logger.log(`Retrying Redis connection in ${finalDelay}ms`);
            return finalDelay;
          },
          
          // Event handlers for connection status
          enableReadyCheck: true,
          enableOfflineQueue: true,
          
          // Connection events (logged for monitoring)
          onClientCreated: (client: any) => {
            // Register Redis connection event handlers with proper logging
            logger.log('Redis client created, registering event handlers', 'RedisCacheModule');
            
            client.on('connect', () => {
              logger.log('Redis client connecting', 'RedisCacheModule');
            });
            
            client.on('ready', () => {
              logger.log('Redis client connected and ready', 'RedisCacheModule');
            });
            
            client.on('error', (err: Error) => {
              logger.error('Redis client error', err?.stack || err?.message, 'RedisCacheModule');
            });
            
            client.on('reconnecting', () => {
              logger.warn('Redis client reconnecting', 'RedisCacheModule');
            });
            
            client.on('end', () => {
              logger.warn('Redis client disconnected', 'RedisCacheModule');
            });
          },
        };
      },
      inject: [ConfigService],
      isGlobal: true,
    }),
    // ThrottlerModule: Configures rate limiting for the application.
    // `ttl` defines the time window (in milliseconds) and `limit` defines the maximum requests within that window.
    // `isGlobal: true` makes the ThrottlerGuard available application-wide.
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 requests per minute
      },
    ]),
    HealthModule, // Add HealthModule to imports
    DatabaseModule, // Module for database connection lifecycle management
    CacheCleanupModule, // Module for Redis connection lifecycle management
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // APP_GUARD: Applies the ThrottlerGuard globally to all routes.
    // This ensures that all incoming requests are subject to the defined rate limits.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure global middleware for the application
   * @param consumer Middleware consumer for configuring middleware
   */
  configure(consumer: MiddlewareConsumer): void {
    // Apply CorrelationIdMiddleware to all routes to enable request correlation IDs
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
