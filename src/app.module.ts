import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
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
      useFactory: (configService: ConfigService) => ({
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
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
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
        ttl: (configService.get<number>('REDIS_TTL') || 3600) * 1000, // Cache TTL in milliseconds, configurable via environment.
      }),
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
export class AppModule {}
