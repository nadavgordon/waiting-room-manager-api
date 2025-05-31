import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { ThrottlerModule } from '@nestjs/throttler';

/**
 * @file auth-basic.e2e-spec.ts
 * @description Basic end-to-end tests for the authentication module, covering only user registration validation.
 */
describe('Auth Basic (e2e)', () => {
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

  it('/auth/register (POST) - should register a user with a valid password', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser1', password: 'Password123!' })
      .expect(201);
  });

  it('/auth/register (POST) - should return 400 for a password that is too short', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser2', password: 'Pass1!' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must be at least 8 characters long');
      });
  });

  it('/auth/register (POST) - should return 400 for a password missing uppercase', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser3', password: 'password123!' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });

  it('/auth/register (POST) - should return 400 for a password missing lowercase', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser4', password: 'PASSWORD123!' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });

  it('/auth/register (POST) - should return 400 for a password missing number', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser5', password: 'Password!!' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });

  it('/auth/register (POST) - should return 400 for a password missing special character', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser6', password: 'Password123' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });

  it('/auth/register (POST) - should return 400 for a password that is too long', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser7', password: 'Password12345!' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });
});