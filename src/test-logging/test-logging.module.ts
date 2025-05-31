import { Module } from '@nestjs/common';
import { TestLoggingController } from './test-logging.controller';
import { LoggerModule } from '../common/logger/logger.module';

/**
 * @file test-logging.module.ts
 * @description Module for test-logging functionality. This module is used for testing
 * logging security features like PII masking and log sanitization.
 */
@Module({
  imports: [LoggerModule],
  controllers: [TestLoggingController],
})
export class TestLoggingModule {}