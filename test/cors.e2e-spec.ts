import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { LoggerService } from '../src/common/logger/logger.service';
import { AppDataSource } from '../src/db/data-source';

describe('CORS (e2e)', () => {
  let app: INestApplication;
  let originalEnv: NodeJS.ProcessEnv;


  // beforeEach and afterEach are now inside the describe block
  beforeAll(async () => {
    originalEnv = process.env;
  });

  beforeAll(async () => {
    originalEnv = process.env;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    process.env = originalEnv;
  });

  const setupAppWithCors = async (corsOrigins: string | undefined) => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'a_very_long_and_secure_jwt_secret_for_testing_purposes_at_least_32_chars', // Mock JWT_SECRET for tests
      DB_TYPE: 'postgres', // Ensure tests use postgres
      DB_HOST: 'localhost',
      DB_PORT: '5432',
      DB_USERNAME: 'postgres',
      DB_PASSWORD: 'password',
      DB_DATABASE: 'waiting_room_db',
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(LoggerService));

    const { httpAdapter } = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    app.enableCors({
      origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
        const allowedOrigins = corsOrigins ? corsOrigins.split(',') : [];
        if (allowedOrigins.length === 0) {
          callback(null, false);
        } else if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    });

    await app.init();
    return app;
  };

  it('should allow requests from a whitelisted origin', async () => {
    app = await setupAppWithCors('http://localhost:3001');
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should block requests from a non-whitelisted origin', async () => {
    app = await setupAppWithCors('http://localhost:3001');
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://evil.com');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should block all cross-origin requests when CORS_ORIGINS is empty', async () => {
    app = await setupAppWithCors('');
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should block all cross-origin requests when CORS_ORIGINS is not set', async () => {
    app = await setupAppWithCors(undefined);
    const response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('should allow multiple whitelisted origins', async () => {
    app = await setupAppWithCors('http://localhost:3001,https://another-frontend.com');
    let response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'http://localhost:3001');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3001');

    response = await request(app.getHttpServer())
      .get('/')
      .set('Origin', 'https://another-frontend.com');
    expect(response.headers['access-control-allow-origin']).toBe('https://another-frontend.com');
  });
});