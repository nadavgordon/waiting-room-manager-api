import { Controller, Get, Query, Logger } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

/**
 * @file test-logging.controller.ts
 * @description Test controller for logging security tests. This controller provides endpoints
 * that are used by the logging.e2e-spec.ts tests to verify PII masking and log sanitization.
 */
@Controller('test-logging')
export class TestLoggingController {
  private readonly logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger;
  }

  /**
   * Endpoint to test PII masking in log messages
   * @param username The username to be masked in logs
   * @param userId The user ID to be masked in logs
   * @returns A success message
   */
  @Get('log-pii')
  logPii(@Query('username') username: string, @Query('userId') userId: string) {
    this.logger.log(`User logged in: {"username":"${username}", "userId":"${userId}"}`, 'TestLoggingController');
    return { success: true };
  }

  /**
   * Endpoint to test log sanitization for malicious input
   * @param input Potentially malicious input with newlines and null bytes
   * @returns A success message
   */
  @Get('log-malicious')
  logMalicious(@Query('input') input: string) {
    this.logger.log(`User input: ${input}`, 'TestLoggingController');
    return { success: true };
  }

  /**
   * Endpoint to test PII masking and sanitization in error context
   * @param context Context containing PII and potentially malicious characters
   * @param trace Stack trace containing PII and potentially malicious characters
   * @returns A success message
   */
  @Get('log-error-with-pii-and-malicious')
  logErrorWithPiiAndMalicious(
    @Query('context') context: string,
    @Query('trace') trace: string,
  ) {
    this.logger.error('An error occurred', trace, context);
    return { success: true };
  }
}