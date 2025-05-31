import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { createLogger, format, transports } from 'winston';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  /**
   * `AllExceptionsFilter` is a global exception filter that catches all unhandled exceptions
   * across the NestJS application. Its primary role is to standardize error responses
   * and provide consistent logging for operational visibility.
   *
   * It leverages Winston for structured logging, ensuring that error details,
   * including stack traces, are captured in a machine-readable format.
   */
  private readonly logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(format.timestamp(), format.json()),
    transports: [new transports.Console()],
  });

  /**
   * Catches and processes exceptions.
   * It determines the appropriate HTTP status code and error message based on the exception type,
   * logs the error, and sends a standardized JSON error response to the client.
   * @param exception The caught exception object.
   * @param host The `ArgumentsHost` provides access to the execution context (e.g., HTTP request/response).
   */
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Determine the HTTP status code. If it's an `HttpException`, use its status; otherwise, default to 500.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract the error message. For `HttpException`, it can be a string or an object.
    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any).message || exception.getResponse()
        : 'Internal server error';

    // Construct the standardized error response payload.
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? message : message,
    };

    // Log the error with full details, including stack trace for debugging.
    this.logger.error(`Unhandled exception: ${message}`, {
      ...errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Send the error response to the client.
    response.status(status).json(errorResponse);
  }
}
