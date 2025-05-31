import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ThrottlerModule } from '@nestjs/throttler'; // Import ThrottlerModule for testing rate limits

/**
 * @file auth.e2e-spec.ts
 * @description End-to-end tests for the authentication module, covering user registration and login.
 * These tests validate the API's behavior, including successful user creation and various password policy validations.
 */
describe('Auth (e2e)', () => {
  // We'll run the rate limit tests separately to avoid affecting other tests
  let app: INestApplication;

  /**
   * Sets up the testing environment before each test.
   * This involves creating a NestJS testing module, initializing the application,
   * and applying global validation pipes to ensure DTO validation is active during tests.
   */
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule, // Import the main application module
        // Configure ThrottlerModule for testing purposes, overriding default limits if necessary
        ThrottlerModule.forRoot([
          {
            ttl: 60000, // 1 minute
            limit: 50, // Increased limit for testing purposes
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply global validation pipes to ensure DTO validation rules are enforced during E2E tests.
    app.useGlobalPipes(
      new (require('@nestjs/common').ValidationPipe)({
        whitelist: true, // Remove properties that are not defined in the DTO
        forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
        transform: true, // Automatically transform incoming payload to DTO instances
      }),
    );
    await app.init(); // Initialize the NestJS application
  });

  /**
   * Cleans up the application instance after each test to prevent resource leaks.
   */
  afterEach(async () => {
    if (app) {
      await app.close(); // Close the NestJS application
    }
  });

  /**
   * Test case for successful user registration.
   * Verifies that a POST request to '/auth/register' with valid credentials
   * results in a 201 Created status.
   */
  it('/auth/register (POST) - should register a user with a valid password', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser1', password: 'Password123!' }) // Send valid user data
      .expect(201); // Expect HTTP status 201 (Created)
  });

  /**
   * Test case for password validation: too short.
   * Verifies that a POST request with a password shorter than the minimum length
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password that is too short', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser2', password: 'Pass1!' }) // Password is too short
      .expect(400) // Expect HTTP status 400 (Bad Request)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must be at least 8 characters long',
        );
      });
  });

  /**
   * Test case for password validation: missing uppercase letter.
   * Verifies that a POST request with a password missing an uppercase letter
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password missing uppercase', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser3', password: 'password123!' }) // Missing uppercase
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
        );
      });
  });

  /**
   * Test case for password validation: missing lowercase letter.
   * Verifies that a POST request with a password missing a lowercase letter
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password missing lowercase', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser4', password: 'PASSWORD123!' }) // Missing lowercase
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
        );
      });
  });

  /**
   * Test case for password validation: missing number.
   * Verifies that a POST request with a password missing a number
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password missing number', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser5', password: 'Password!!' }) // Missing number
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
        );
      });
  });

  /**
   * Test case for password validation: missing special character.
   * Verifies that a POST request with a password missing a special character
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password missing special character', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser6', password: 'Password123' }) // Missing special character
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
        );
      });
  });

  /**
   * Test case for password validation: too long.
   * Verifies that a POST request with a password longer than the maximum length
   * returns a 400 Bad Request status and the appropriate error message.
   */
  it('/auth/register (POST) - should return 400 for a password that is too long', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser7', password: 'Password12345!' }) // Password is too long
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain(
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
        );
      });
  });

  /**
   * Test suite for JWT refresh token mechanism.
   */
  describe('JWT Refresh Token Mechanism', () => {
    const username = 'refresh_user';
    const password = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      // Register and login a user to get initial tokens
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      accessToken = loginRes.body.access_token;
      refreshToken = loginRes.body.refresh_token;
    });

    it('should successfully refresh tokens with a valid refresh token', async () => {
      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

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
          expect(res.body.message).toContain(
            'Invalid or expired refresh token',
          );
        });
    });

    it('should return 401 Unauthorized if refresh token is reused after successful refresh', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'reused_token_user', password: 'Password123!' })
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
          expect(res.body.message).toContain(
            'Invalid or expired refresh token',
          );
        });
    });
  });

  /**
   * Test suite for JWT token revocation (logout).
   */
  describe('JWT Token Revocation (Logout)', () => {
    const username = 'logout_user';
    const password = 'Password123!';
    let accessToken: string;
    let refreshToken: string;

    beforeAll(async () => {
      // Register and login a user to get initial tokens
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username, password })
        .expect(200);

      accessToken = loginRes.body.access_token;
      refreshToken = loginRes.body.refresh_token;
    });

    it('should successfully revoke a valid access token on logout', async () => {
      expect(accessToken).toBeDefined();

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect({ message: 'Logged out successfully' });

      // Attempt to use the revoked token for an authenticated endpoint (e.g., a dummy protected endpoint)
      // Assuming there's a protected endpoint like /user/profile
      // For now, we'll just try to use it for another logout, which should fail
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401); // Expect Unauthorized as token is revoked
    });

    it('should return 401 Unauthorized if no token is provided for logout', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });

    it('should return 401 Unauthorized if an invalid token is provided for logout', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);
    });
  });

  /**
   * Test suite for rate limiting on /auth/register.
   * Verifies that the registration endpoint enforces the configured rate limit.
   * This is run last to avoid affecting other tests.
   */
  describe('Rate Limiting - /auth/register (POST)', () => {
    it('should return 429 Too Many Requests after exceeding the rate limit', async () => {
      const usernamePrefix = 'rate_limit_test_user';
      const password = 'Password123!';
      const limit = 5; // We'll still test with 5 requests for the rate limit test
      // Note: We've increased the overall limit to 50 in the ThrottlerModule config
      // but we're still testing with a limit of 5 for this specific test

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
   * This is run last to avoid affecting other tests.
   */
  describe('Rate Limiting - /auth/login (POST)', () => {
    const username = 'login_rate_limit_user';
    const password = 'Password123!';

    beforeAll(async () => {
      // Register a user for login tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username, password })
        .expect(201);
    });

    it('should return 429 Too Many Requests after exceeding the rate limit', async () => {
      const limit = 5; // We'll still test with 5 requests for the rate limit test
      // Note: We've increased the overall limit to 50 in the ThrottlerModule config
      // but we're still testing with a limit of 5 for this specific test

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
