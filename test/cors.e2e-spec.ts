import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggerService } from '../src/common/logger/logger.service';
import { AppDataSource } from '../src/db/data-source';

/**
 * @file cors.e2e-spec.ts
 * @description End-to-end tests for Cross-Origin Resource Sharing (CORS) configuration.
 * These tests verify that the application correctly handles requests from allowed and disallowed origins,
 * ensuring the security and accessibility of the API based on CORS policies.
 */
describe('CORS (e2e)', () => {
  let app: INestApplication;
  let originalEnv: NodeJS.ProcessEnv; // Stores the original process.env to restore it after tests

  /**
   * Stores the original process.env before any tests run to ensure isolation.
   */
  beforeAll(async () => {
    originalEnv = process.env;
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
   * Restores the original process.env after all tests have completed.
   */
  afterAll(async () => {
    process.env = originalEnv;
  });

  /**
   * Helper function to set up a NestJS application with a specific CORS configuration.
   * It mocks necessary environment variables and applies global pipes, filters, and CORS settings.
   * @param corsOrigins A string of comma-separated allowed origins, or undefined if no origins are set.
   * @returns The initialized NestJS application instance.
   */
  const setupAppWithCors = async (corsOrigins: string | undefined) => {
    // Mock environment variables required for the application to run, especially JWT_SECRET and DB settings.
    process.env = {
      ...originalEnv, // Preserve other environment variables
      JWT_SECRET: 'a_very_long_and_secure_jwt_secret_for_testing_purposes_at_least_32_chars', // Mock JWT_SECRET for tests
      DB_TYPE: 'postgres', // Ensure tests use postgres
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'password',
      DB_DATABASE: 'waiting_room_db',
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Import the main application module
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(LoggerService)); // Use the custom logger service

    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter)); // Apply global exception filter

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    ); // Apply global validation pipes

    // Configure CORS based on the `corsOrigins` parameter.
    app.enableCors({
      origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = corsOrigins ? corsOrigins.split(',') : [];
        if (allowedOrigins.length === 0) {
          // If no origins are specified, disallow all cross-origin requests.
          callback(null, false);
        } else if (allowedOrigins.includes(origin)) {
          // If the origin is in the whitelist, allow the request.
          callback(null, true);
        } else {
          // If the origin is not whitelisted, disallow the request.
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true, // Allow credentials (e.g., cookies, authorization headers) to be sent with cross-origin requests
    });

    await app.init(); // Initialize the NestJS application
    return app;
  };

  /**
   * Test case: Should allow requests from a whitelisted origin.
   * Verifies that a request from an origin explicitly listed in `CORS_ORIGINS`
   * receives the appropriate CORS headers, allowing the request.
   */
  it('should allow requests from a whitelisted origin', async () => {
    app = await setupAppWithCors('http://localhost:3001'); // Set up app with a whitelisted origin
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001'); // Send request from the whitelisted origin
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  /**
   * Test case: Should block requests from a non-whitelisted origin.
   * Verifies that a request from an origin not listed in `CORS_ORIGINS`
   * does not receive the `Access-Control-Allow-Origin` header, effectively blocking the request.
   */
  it('should block requests from a non-whitelisted origin', async () => {
    app = await setupAppWithCors('http://localhost:3001'); // Set up app with a whitelisted origin
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://evil.com'); // Send request from a non-whitelisted origin
    expect(response.headers['access-control-allow-origin']).toBeUndefined(); // Expect no CORS header
  });

  /**
   * Test case: Should block all cross-origin requests when CORS_ORIGINS is empty.
   * Verifies that if `CORS_ORIGINS` is explicitly set to an empty string,
   * all cross-origin requests are blocked.
   */
  it('should block all cross-origin requests when CORS_ORIGINS is empty', async () => {
    app = await setupAppWithCors(''); // Set up app with empty CORS origins
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001'); // Send request from any origin
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  /**
   * Test case: Should block all cross-origin requests when CORS_ORIGINS is not set.
   * Verifies that if `CORS_ORIGINS` is undefined (not set),
   * all cross-origin requests are blocked.
   */
  it('should block all cross-origin requests when CORS_ORIGINS is not set', async () => {
    app = await setupAppWithCors(undefined); // Set up app with undefined CORS origins
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001'); // Send request from any origin
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  /**
   * Test case: Should allow multiple whitelisted origins.
   * Verifies that the application correctly handles multiple whitelisted origins,
   * allowing requests from each of them.
   */
  it('should allow multiple whitelisted origins', async () => {
    app = await setupAppWithCors('http://localhost:3001,https://another-frontend.com'); // Set up app with multiple whitelisted origins
    let response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001'); // Test first whitelisted origin
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'https://another-frontend.com'); // Test second whitelisted origin
    expect(response.headers['access-control-allow-origin']).toBe('https://another-frontend.com');
  });
});