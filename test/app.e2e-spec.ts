import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

:start_line:7
-------
/**
 * @file app.e2e-spec.ts
 * @description End-to-end tests for the core application functionality, specifically the root endpoint.
 * These tests ensure that the application initializes correctly and responds as expected to basic HTTP requests.
 */
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  /**
   * Sets up the testing environment before each test.
   * This includes creating a NestJS testing module and initializing the application.
   * The AppModule is imported to ensure all necessary dependencies and configurations are loaded.
   */
  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init(); // Initialize the NestJS application
  });

  /**
   * Test case for the root '/' GET endpoint.
   * It verifies that a GET request to the root path returns a 200 OK status
   * and the expected "Hello World!" message.
   */
  it('/ (GET) - should return "Hello World!"', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200) // Expect HTTP status 200 (OK)
      .expect('Hello World!'); // Expect the response body to be "Hello World!"
  });
});
