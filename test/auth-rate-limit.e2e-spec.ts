import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * @file auth-rate-limit.e2e-spec.ts
 * @description End-to-end tests for rate limiting on authentication endpoints.
 */
describe('Auth Rate Limiting (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        // Configure ThrottlerModule with a low limit specifically for testing rate limiting
        ThrottlerModule.forRoot([
          {
            ttl: 60000, // 1 minute
            limit: 5, // 5 requests per minute for testing rate limiting
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Test suite for rate limiting on /auth/register.
   * Verifies that the registration endpoint enforces the configured rate limit.
   */
  describe('Rate Limiting - /auth/register (POST)', () => {
    it('should return 429 Too Many Requests after exceeding the rate limit', async () => {
      const usernamePrefix = 'rate_limit_register_user';
      const password = 'Password123!';
      const limit = 5; // As per the ThrottlerModule configuration above

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        await request(app.getHttpServer())
          .post('/auth/register')
          .send({ username: `${usernamePrefix}_${i}`, password })
          .expect(201);
      }

      // The next request should be rate-limited
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: `${usernamePrefix}_${limit}`, password })
        .expect(429); // Expect HTTP status 429 (Too Many Requests)
    }, 70000); // Increase timeout for rate limit tests
  });

  /**
   * Test suite for rate limiting on /auth/login.
   * Verifies that the login endpoint enforces the configured rate limit.
   */
  describe('Rate Limiting - /auth/login (POST)', () => {
    const username = 'rate_limit_login_user';
    const password = 'Password123!';

    it('should register a user for login tests', async () => {
      // Register a user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);
    });

    it('should return 429 Too Many Requests after exceeding the rate limit', async () => {
      const limit = 5; // As per the ThrottlerModule configuration above

      // Make requests up to the limit
      for (let i = 0; i < limit; i++) {
        await request(app.getHttpServer())
          .post('/auth/login')
          .send({ username, password: 'wrongpassword' }) // Use wrong password to avoid successful login
          .expect(401); // Expect Unauthorized for wrong password
      }

      // The next request should be rate-limited
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password: 'wrongpassword' })
        .expect(429); // Expect HTTP status 429 (Too Many Requests)
    }, 70000); // Increase timeout for rate limit tests
  });
});
