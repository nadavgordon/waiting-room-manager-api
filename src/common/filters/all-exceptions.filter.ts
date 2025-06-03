import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { createLogger, format, transports } from 'winston';
import { Response } from 'express';
import { Request } from 'express';

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
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Determine the HTTP status code. If it's an `HttpException`, use its status; otherwise, default to 500.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract the error message. For `HttpException`, it can be a string or an object.
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      exception instanceof HttpException
        ? typeof exceptionResponse === 'object' &&
          exceptionResponse !== null &&
          'message' in exceptionResponse
          ? (exceptionResponse as { message: string }).message
          : exceptionResponse
        : 'Internal server error';

    // Construct the standardized error response payload.
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    };

    // Format the message safely to avoid '[object Object]' stringification issues
    const safeMessage =
      typeof message === 'string'
        ? message
        : message === null
          ? 'null'
          : typeof message === 'object'
            ? JSON.stringify(message)
            : String(message);

    // Log the error with full details, including stack trace for debugging.
    this.logger.error(`Unhandled exception: ${safeMessage}`, {
      ...errorResponse,
      stack: exception instanceof Error ? exception.stack : undefined,
    });

    // Send the error response to the client.
    if (
      typeof response.status === 'function' &&
      typeof response.json === 'function'
    ) {
      response.status(status).json(errorResponse);
    } else {
      console.error('Unable to send response, invalid response object');
    }
  }
}
