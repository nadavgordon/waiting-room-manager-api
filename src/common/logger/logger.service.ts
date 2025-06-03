import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import {
  createLogger,
  format,
  transports,
  Logger as WinstonLogger,
} from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  /**
   * `LoggerService` provides a custom logging solution for the NestJS application,
   * integrating with Winston for structured and flexible logging.
   * It implements NestJS's `LoggerService` interface, allowing it to be used
   * as the application's default logger.
   *
   * Logs are formatted as JSON with timestamps, making them suitable for
   * centralized log management systems. The logging level is configurable
   * via the `LOG_LEVEL` environment variable.
   */
  private readonly logger: WinstonLogger;

  constructor() {
    this.logger = createLogger({
      level: process.env.LOG_LEVEL || 'info', // Configurable log level.
      format: format.combine(
        format.timestamp(), // Adds a timestamp to each log entry.
        format.json(), // Ensures logs are in JSON format for structured logging.
        format.json(), // Just use JSON format since we're pre-processing in the log methods
      ),
      transports: [
        new transports.Console(), // Outputs logs to the console.
      ],
    });
  }

  /**
   * Masks Personally Identifiable Information (PII) from a string.
   * Specifically targets 'username' and 'userId' patterns.
   * @param message The string to mask.
   * @returns The masked string.
   */
  private maskPII(message: string): string {
    if (typeof message !== 'string') {
      return message;
    }
    
    let maskedMessage = message;
    // Mask username - more generic pattern to catch various JSON formats
    maskedMessage = maskedMessage.replace(
      /(["']?username["']?\s*:\s*["']?)([^"',\}\]]+)(["']?)/gi,
      '$1[MASKED_USERNAME]$3',
    );
    // Mask userId - more generic pattern to catch UUIDs in various formats
    maskedMessage = maskedMessage.replace(
      /(["']?userId["']?\s*:\s*["']?)([a-f0-9-]+)(["']?)/gi,
      '$1[MASKED_USERID]$3',
    );
    return maskedMessage;
  }

  /**
   * Sanitizes a log message to prevent log injection attacks.
   * Escapes newline characters and other potentially harmful characters.
   * @param message The string to sanitize.
   * @returns The sanitized string.
   */
  private sanitizeLogMessage(message: string): string {
    if (typeof message !== 'string') {
      return message;
    }
    
    // First replace null bytes to prevent issues with string processing
    let sanitizedMessage = message.replace(/\0/g, '\\0');
    
    // Replace all newline characters with their escaped versions
    // Make sure to escape the backslash in the replacement string
    sanitizedMessage = sanitizedMessage.replace(/\n/g, '\\n');
    sanitizedMessage = sanitizedMessage.replace(/\r/g, '\\r');
    
    return sanitizedMessage;
  }

  /**
   * Logs a message at the 'info' level.
   * @param message The primary log message.
   * @param context Optional context (e.g., class or method name) for the log entry.
   */
  log(message: string, context?: string) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.info(processedMessage, { context: processedContext });
  }

  /**
   * Logs an error message at the 'error' level.
   * @param message The error message.
   * @param trace Optional stack trace associated with the error.
   * @param context Optional context for the log entry.
   */
  error(message: string, trace?: string, context?: string) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedTrace = trace ? this.sanitizeLogMessage(this.maskPII(trace)) : trace;
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.error(processedMessage, { trace: processedTrace, context: processedContext });
  }

  /**
   * Logs a warning message at the 'warn' level.
   * @param message The warning message.
   * @param context Optional context for the log entry.
   */
  warn(message: string, context?: string) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.warn(processedMessage, { context: processedContext });
  }

  /**
   * Logs a debug message at the 'debug' level.
   * @param message The debug message.
   * @param context Optional context for the log entry.
   */
  debug(message: string, context?: string) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.debug(processedMessage, { context: processedContext });
  }

  /**
   * Logs a verbose message at the 'verbose' level.
   * @param message The verbose message.
   * @param context Optional context for the log entry.
   */
  verbose(message: string, context?: string) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.verbose(processedMessage, { context: processedContext });
  }
}
