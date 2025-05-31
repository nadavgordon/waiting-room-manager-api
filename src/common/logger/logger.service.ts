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
        format((info) => {
          // Mask PII and sanitize messages before logging
          info.message = this.sanitizeLogMessage(
            this.maskPII(info.message as string),
          );
          if (info.context) {
            info.context = this.sanitizeLogMessage(
              this.maskPII(info.context as string),
            );
          }
          if (info.trace) {
            info.trace = this.sanitizeLogMessage(
              this.maskPII(info.trace as string),
            );
          }
          return info;
        })(),
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
    let maskedMessage = message;
    // Mask username
    maskedMessage = maskedMessage.replace(
      /(["']?username["']?\s*:\s*["'])([^"']+)(["'])/gi,
      '$1[MASKED_USERNAME]$3',
    );
    // Mask userId (assuming it's a UUID or similar string)
    maskedMessage = maskedMessage.replace(
      /(["']?userId["']?:\s*["'])([a-f0-9-]+)(["'])/gi,
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
    // Replace newline characters to prevent log injection
    let sanitizedMessage = message.replace(/(\r\n|\n|\r)/gm, '\\n');
    // Escape other potentially harmful characters if necessary (e.g., null bytes, control characters)
    // For simplicity, focusing on newlines as the primary injection vector for logs.
    // More comprehensive sanitization might involve encoding or removing non-printable ASCII.
    sanitizedMessage = sanitizedMessage.replace(/\0/g, '\\0'); // Replace null bytes
    return sanitizedMessage;
  }

  /**
   * Logs a message at the 'info' level.
   * @param message The primary log message.
   * @param context Optional context (e.g., class or method name) for the log entry.
   */
  log(message: string, context?: string) {
    this.logger.info(message, { context });
  }

  /**
   * Logs an error message at the 'error' level.
   * @param message The error message.
   * @param trace Optional stack trace associated with the error.
   * @param context Optional context for the log entry.
   */
  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, { trace, context });
  }

  /**
   * Logs a warning message at the 'warn' level.
   * @param message The warning message.
   * @param context Optional context for the log entry.
   */
  warn(message: string, context?: string) {
    this.logger.warn(message, { context });
  }

  /**
   * Logs a debug message at the 'debug' level.
   * @param message The debug message.
   * @param context Optional context for the log entry.
   */
  debug(message: string, context?: string) {
    this.logger.debug(message, { context });
  }

  /**
   * Logs a verbose message at the 'verbose' level.
   * @param message The verbose message.
   * @param context Optional context for the log entry.
   */
  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context });
  }
}
