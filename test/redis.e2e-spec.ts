import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

/**
 * @file redis.e2e-spec.ts
 * @description End-to-end tests for Redis security configuration.
 * These tests verify that the application correctly enforces Redis password requirements
 * in a production environment and handles missing or provided passwords appropriately.
 */
describe('Redis Security (e2e)', () => {
  let app: INestApplication;
  let originalNodeEnv: string;
  let originalRedisPassword: string | undefined;
  let originalRedisHost: string | undefined; // Store original REDIS_HOST

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV || '';
    originalRedisPassword = process.env.REDIS_PASSWORD;
    originalRedisHost = process.env.REDIS_HOST; // Store original REDIS_HOST
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    process.env.NODE_ENV = originalNodeEnv;
    if (originalRedisPassword !== undefined) {
      process.env.REDIS_PASSWORD = originalRedisPassword;
    } else {
      delete process.env.REDIS_PASSWORD;
    }
    if (originalRedisHost !== undefined) { // Restore original REDIS_HOST
      process.env.REDIS_HOST = originalRedisHost;
    } else {
      delete process.env.REDIS_HOST;
    }
  });

  it('should throw an error if REDIS_PASSWORD is not set in production environment', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_PASSWORD;

    await expect(
      Test.createTestingModule({
        imports: [AppModule],
      }).compile(),
    ).rejects.toThrow('REDIS_PASSWORD must be set in production environment.');
  });

  it('should successfully initialize if REDIS_PASSWORD is set in production environment', async () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_PASSWORD = 'test_redis_password';
    process.env.REDIS_HOST = 'localhost'; // Ensure host is set for connection

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await expect(app.init()).resolves.not.toThrow(); // Expect no error on init
  });

  it('should successfully initialize if REDIS_PASSWORD is not set in development environment', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.REDIS_PASSWORD;
    process.env.REDIS_HOST = 'localhost'; // Ensure host is set for connection

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await expect(app.init()).resolves.not.toThrow(); // Expect no error on init
  });
});