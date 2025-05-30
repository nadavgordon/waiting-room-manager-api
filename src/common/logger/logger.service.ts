import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createLogger, format, transports, Logger as WinstonLogger } from 'winston';

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
      ),
      transports: [
        new transports.Console(), // Outputs logs to the console.
      ],
    });
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