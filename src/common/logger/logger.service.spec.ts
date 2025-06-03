import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';
import * as winston from 'winston';

/**
 * @file src/common/logger/logger.service.spec.ts
 * @description Unit tests for the `LoggerService`, focusing on PII masking and log sanitization.
 * This file ensures that sensitive information like usernames and user IDs are correctly masked
 * and that log messages are sanitized to prevent log injection vulnerabilities.
 */
describe('LoggerService (Unit)', () => {
  let service: LoggerService;
  let mockInfoFn: jest.Mock;

  beforeEach(async () => {
    // Create a mock info function that we can inspect later
    mockInfoFn = jest.fn();

    // Mock Winston's createLogger to avoid actual logging during tests
    jest.spyOn(winston, 'createLogger').mockReturnValue({
      info: mockInfoFn,
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
    } as unknown as winston.Logger);

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  /**
   * @description Tests the PII masking functionality of the LoggerService.
   * It verifies that 'username' and 'userId' patterns are correctly replaced
   * with masked placeholders in log messages.
   */
  it('should mask PII in log messages', () => {
    const originalMessage =
      'User logged in: {"username":"testuser", "userId":"123e4567-e89b-12d3-a456-426614174000"}';

    // Call the public method that uses maskPII internally
    service.log(originalMessage);

    // Get the captured log message from the mock

    expect(mockInfoFn.mock.calls.length).toBeGreaterThan(0);

    // Safely get the first call with type checking

    const mockCalls = mockInfoFn.mock.calls;
    if (!mockCalls || !Array.isArray(mockCalls) || mockCalls.length === 0) {
      fail('No mock calls recorded');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const firstCall = mockCalls[0];
    if (!firstCall || !Array.isArray(firstCall) || firstCall.length === 0) {
      fail('First call has invalid format');
      return;
    }

    const capturedMessage = String(firstCall[0]);

    // Verify the log doesn't contain sensitive data
    expect(capturedMessage).not.toContain('testuser');
    expect(capturedMessage).not.toContain(
      '123e4567-e89b-12d3-a456-426614174000',
    );
    expect(capturedMessage).toContain('[MASKED_USERNAME]');
    expect(capturedMessage).toContain('[MASKED_USERID]');
  });

  /**
   * @description Tests the log sanitization functionality of the LoggerService.
   * It verifies that newline characters and null bytes are correctly escaped
   * in log messages to prevent log injection.
   */
  it('should sanitize log messages by escaping newlines and null bytes', () => {
    const maliciousMessage = 'User input: Hello\nWorld!\r\nAnother line.\0';

    // Call the public method that uses sanitizeLogMessage internally
    service.log(maliciousMessage);

    // Get the captured log message from the mock

    expect(mockInfoFn.mock.calls.length).toBeGreaterThan(0);

    // Safely get the first call with type checking

    const mockCalls = mockInfoFn.mock.calls;
    if (!mockCalls || !Array.isArray(mockCalls) || mockCalls.length === 0) {
      fail('No mock calls recorded');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const firstCall = mockCalls[0];
    if (!firstCall || !Array.isArray(firstCall) || firstCall.length === 0) {
      fail('First call has invalid format');
      return;
    }

    const capturedMessage = String(firstCall[0]);

    // Verify the log message is sanitized
    expect(capturedMessage).not.toContain('\n');
    expect(capturedMessage).not.toContain('\r');
    expect(capturedMessage).not.toContain('\0');
    expect(capturedMessage).toContain('\\n');
  });
});
