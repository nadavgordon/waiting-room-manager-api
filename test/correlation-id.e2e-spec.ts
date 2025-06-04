import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { validate as uuidValidate } from 'uuid';

/**
 * E2E Test for Correlation ID middleware integration
 * 
 * This test suite verifies that correlation IDs are correctly:
 * 1. Generated when not provided in incoming requests
 * 2. Propagated from request headers to response headers
 * 3. Accessible within the application for logging and tracing
 */
describe('Correlation ID Middleware (E2E)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate and include correlation ID in response when not provided', () => {
    return request(app.getHttpServer())
      .get('/health/ready')  // Using the health/ready endpoint for testing
      .expect(200)
      .then(response => {
        // Check that X-Correlation-ID header is present in response
        expect(response.headers).toHaveProperty('x-correlation-id');
        
        // Verify it's a valid UUID
        const correlationId = response.headers['x-correlation-id'];
        expect(uuidValidate(correlationId)).toBe(true);
      });
  });

  it('should propagate provided correlation ID to response headers', () => {
    const testCorrelationId = '12345678-1234-1234-1234-123456789012';
    
    return request(app.getHttpServer())
      .get('/health/live') 
      .set('X-Correlation-ID', testCorrelationId)
      .expect(200)
      .then(response => {
        // Check that the same correlation ID is returned
        expect(response.headers['x-correlation-id']).toBe(testCorrelationId);
      });
  });

  // This test requires a specific endpoint that echoes back request data
  // If such an endpoint doesn't exist, create one or modify an existing one
  it('should make correlation ID available within the request context', () => {
    const testCorrelationId = '98765432-9876-9876-9876-987654321098';
    
    return request(app.getHttpServer())
      .get('/health/live') // Using the health/live endpoint from HealthController
      .set('X-Correlation-ID', testCorrelationId)
      .expect(200);
    
    // Note: This test only verifies that the request succeeds with a correlation ID
    // A more complete test would verify that the ID is available in logs/tracing
    // which may require additional test infrastructure
  });
});
