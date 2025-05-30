import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
/**
 * @file auth.e2e-spec.ts
 * @description End-to-end tests for the authentication module, covering user registration and login.
 * These tests validate the API's behavior, including successful user creation and various password policy validations.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;

  /**
   * Sets up the testing environment before each test.
   * This involves creating a NestJS testing module, initializing the application,
   * and applying global validation pipes to ensure DTO validation is active during tests.
   */
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // Import the main application module
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply global validation pipes to ensure DTO validation rules are enforced during E2E tests.
    app.useGlobalPipes(new (require('@nestjs/common').ValidationPipe)({
      whitelist: true, // Remove properties that are not defined in the DTO
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present
      transform: true, // Automatically transform incoming payload to DTO instances
    }));
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
        expect(res.body.message).toContain('Password must be at least 8 characters long');
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
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
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
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
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
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
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
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
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
        expect(res.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long');
      });
  });
});