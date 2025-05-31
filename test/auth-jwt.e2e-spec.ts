import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * @file auth-jwt.e2e-spec.ts
 * @description End-to-end tests for JWT refresh token mechanism and token revocation.
 */
describe('Auth JWT (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ThrottlerModule.forRoot([{
          ttl: 60000, // 1 minute
          limit: 50, // Increased limit for testing purposes
        }]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new (require('@nestjs/common').ValidationPipe)({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  /**
   * Test suite for JWT refresh token mechanism.
   */
  describe('JWT Refresh Token Mechanism', () => {
    const username = 'jwt_refresh_user';
    const password = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    it('should register a user and login successfully', async () => {
      // Register a user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);

      // Login to get tokens
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      accessToken = loginRes.body.access_token;
      refreshToken = loginRes.body.refresh_token;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
    });

    it('should successfully refresh tokens with a valid refresh token', async () => {
      // Skip if tokens weren't obtained
      if (!accessToken || !refreshToken) {
        console.log('Skipping test: tokens not available');
        return;
      }

      const refreshRes = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshRes.body.access_token).toBeDefined();
      expect(refreshRes.body.refresh_token).toBeDefined();
      expect(refreshRes.body.access_token).not.toEqual(accessToken); // New access token
      expect(refreshRes.body.refresh_token).not.toEqual(refreshToken); // New refresh token
    });

    it('should return 401 Unauthorized with an invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired refresh token');
        });
    });

    it('should return 401 Unauthorized if refresh token is reused after successful refresh', async () => {
      // Register a new user for this specific test
      const reusedTokenUsername = 'reused_token_user';
      
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: reusedTokenUsername, password })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: reusedTokenUsername, password })
        .expect(200);

      const initialRefreshToken = loginRes.body.refresh_token;

      // First refresh should succeed
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken })
        .expect(200);

      // Second attempt with the same refresh token should fail
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: initialRefreshToken })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid or expired refresh token');
        });
    });
  });

  /**
   * Test suite for JWT token revocation (logout).
   */
  describe('JWT Token Revocation (Logout)', () => {
    const username = 'jwt_logout_user';
    const password = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    it('should register a user and login successfully', async () => {
      // Register a user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);

      // Login to get tokens
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      accessToken = loginRes.body.access_token;
      refreshToken = loginRes.body.refresh_token;

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();
    });

    it('should successfully revoke a valid access token on logout', async () => {
      // Skip if token wasn't obtained
      if (!accessToken) {
        console.log('Skipping test: access token not available');
        return;
      }

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect({ message: 'Logged out successfully' });

      // Attempt to use the revoked token for another logout, which should fail
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401); // Expect Unauthorized as token is revoked
    });

    it('should return 401 Unauthorized if no token is provided for logout', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .expect(401);
    });

    it('should return 401 Unauthorized if an invalid token is provided for logout', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });
});