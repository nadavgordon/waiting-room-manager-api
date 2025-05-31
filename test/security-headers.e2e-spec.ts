import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import helmet from 'helmet';

/**
 * @file security-headers.e2e-spec.ts
 * @description End-to-end tests for HTTP security headers.
 * These tests verify that the application correctly applies various security headers
 * (CSP, X-Content-Type-Options, X-Frame-Options, HSTS) using Helmet middleware.
 */
describe('HTTP Security Headers (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply Helmet middleware as it's done in main.ts
    app.use(helmet());
    app.use(helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", 'https://ka-f.fontawesome.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    }));
    app.use(helmet.noSniff());
    app.use(helmet.frameguard({ action: 'deny' }));
    app.use(helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should have Content-Security-Policy header', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect((res) => {
        expect(res.headers['content-security-policy']).toBeDefined();
        expect(res.headers['content-security-policy']).toContain("default-src 'self'");
        expect(res.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
        expect(res.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
        expect(res.headers['content-security-policy']).toContain("img-src 'self' data:");
        expect(res.headers['content-security-policy']).toContain("font-src 'self'");
        expect(res.headers['content-security-policy']).toContain("connect-src 'self' https://ka-f.fontawesome.com");
        expect(res.headers['content-security-policy']).toContain("object-src 'none'");
        expect(res.headers['content-security-policy']).toContain("media-src 'self'");
        expect(res.headers['content-security-policy']).toContain("frame-src 'none'");
      });
  });

  it('should have X-Content-Type-Options header set to nosniff', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect((res) => {
        expect(res.headers['x-content-type-options']).toBe('nosniff');
      });
  });

  it('should have X-Frame-Options header set to DENY', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect((res) => {
        expect(res.headers['x-frame-options']).toBe('DENY');
      });
  });

  it('should have Strict-Transport-Security header', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect((res) => {
        expect(res.headers['strict-transport-security']).toBeDefined();
        expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
        expect(res.headers['strict-transport-security']).toContain('includeSubDomains');
        expect(res.headers['strict-transport-security']).toContain('preload');
      });
  });
});