import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService } from './logger.service';

/**
 * @file src/common/logger/logger.service.spec.ts
 * @description Unit tests for the `LoggerService`, focusing on PII masking and log sanitization.
 * This file ensures that sensitive information like usernames and user IDs are correctly masked
 * and that log messages are sanitized to prevent log injection vulnerabilities.
 */
describe('LoggerService (Unit)', () => {
  let service: LoggerService;

  beforeEach(async () => {
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
  it('should mask PII (username and userId) in log messages', () => {
    const originalMessage = 'User logged in: {"username":"testuser", "userId":"123e4567-e89b-12d3-a456-426614174000"}';
    // Directly call the private method for testing purposes
    const maskedMessage = (service as any).maskPII(originalMessage);

    expect(maskedMessage).not.toContain('testuser');
    expect(maskedMessage).not.toContain('123e4567-e89b-12d3-a456-426614174000');
    expect(maskedMessage).toContain('[MASKED_USERNAME]');
    expect(maskedMessage).toContain('[MASKED_USERID]');
    expect(maskedMessage).toMatch(/User logged in: {"username":"\[MASKED_USERNAME]", "userId":"\[MASKED_USERID]"}/);
  });

  /**
   * @description Tests the log sanitization functionality of the LoggerService.
   * It verifies that newline characters and null bytes are correctly escaped
   * in log messages to prevent log injection.
   */
  it('should sanitize log messages by escaping newlines and null bytes', () => {
    const maliciousMessage = 'User input: Hello\nWorld!\r\nAnother line.\0';
    // Directly call the private method for testing purposes
    const sanitizedMessage = (service as any).sanitizeLogMessage(maliciousMessage);

    expect(sanitizedMessage).not.toContain('\n');
    expect(sanitizedMessage).not.toContain('\r');
    expect(sanitizedMessage).not.toContain('\0');
    expect(sanitizedMessage).toContain('\\n');
    expect(sanitizedMessage).toContain('\\0');
    expect(sanitizedMessage).toBe('User input: Hello\\nWorld!\\nAnother line.\\0');
  });
});