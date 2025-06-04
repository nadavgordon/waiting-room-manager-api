import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import * as winston from 'winston';
import { AsyncLocalStorage } from 'async_hooks';

// Create an AsyncLocalStorage instance to store correlation IDs
const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

/**
 * The namespace key for storing correlation IDs
 */
const CORRELATION_ID_KEY = 'correlationId';

/**
 * Creates an AsyncLocalStorage store for correlation IDs
 */
export function createCorrelationIdStore(correlationId?: string): Map<string, any> {
  const store = new Map<string, any>();
  if (correlationId) {
    store.set(CORRELATION_ID_KEY, correlationId);
  }
  return store;
}

/**
 * Gets the current correlation ID from AsyncLocalStorage
 * @returns The correlation ID string or null if not found
 */
export function getCurrentCorrelationId(): string | null {
  const store = asyncLocalStorage.getStore();
  return store?.get(CORRELATION_ID_KEY) || null;
}

/**
 * Sets the correlation ID for the current execution context
 * @param correlationId The correlation ID to set
 */
export function setCurrentCorrelationId(correlationId: string): void {
  const store = asyncLocalStorage.getStore() || new Map<string, any>();
  store.set(CORRELATION_ID_KEY, correlationId);
  asyncLocalStorage.enterWith(store);
}

/**
 * Executes a function with a correlation ID context
 * @param correlationId The correlation ID for the context
 * @param fn The function to execute with the correlation ID context
 * @returns The result of the executed function
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  const store = createCorrelationIdStore(correlationId);
  return asyncLocalStorage.run(store, fn);
}

@Injectable()
export class LoggerService implements NestLoggerService {
  /**
   * Winston logger instance for actual logging
   */
  private readonly logger: any;

  constructor() {
    // Determine appropriate log level based on environment
    const logLevel = process.env.LOG_LEVEL || 
                    (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
    
    // Test-friendly simplified logger creation
    // Use a simpler logger configuration to avoid format issues in tests
    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.json(),
      transports: [new winston.transports.Console()]
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
    // Mask password
    maskedMessage = maskedMessage.replace(
      /(password(?:"|\')?\s*(?::|=|is\s+)\s*(?:"|\')?)([^\"\'\s,&]+)/gi,
      '$1[PASSWORD_MASKED]',
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
   * @param metadata Optional additional data to include in the log entry.
   */
  log(message: string, context?: string, metadata?: Record<string, any>) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.info(processedMessage, { 
      context: processedContext,
      correlationId: getCurrentCorrelationId(),
      ...metadata
    });
  }

  /**
   * Logs an error message at the 'error' level.
   * @param message The error message.
   * @param trace Optional stack trace associated with the error.
   * @param context Optional context for the log entry.
   * @param metadata Optional additional data to include in the log entry.
   */
  error(message: string, trace?: string, context?: string, metadata?: Record<string, any>) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedTrace = trace ? this.sanitizeLogMessage(this.maskPII(trace)) : trace;
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.error(processedMessage, { 
      trace: processedTrace, 
      context: processedContext,
      correlationId: getCurrentCorrelationId(),
      ...metadata
    });
  }

  /**
   * Logs a warning message at the 'warn' level.
   * @param message The warning message.
   * @param context Optional context for the log entry.
   * @param metadata Optional additional data to include in the log entry.
   */
  warn(message: string, context?: string, metadata?: Record<string, any>) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.warn(processedMessage, { 
      context: processedContext,
      correlationId: getCurrentCorrelationId(),
      ...metadata
    });
  }

  /**
   * Logs a debug message at the 'debug' level.
   * @param message The debug message.
   * @param context Optional context for the log entry.
   * @param metadata Optional additional data to include in the log entry.
   */
  debug(message: string, context?: string, metadata?: Record<string, any>) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.debug(processedMessage, { 
      context: processedContext,
      correlationId: getCurrentCorrelationId(),
      ...metadata
    });
  }

  /**
   * Logs a verbose message at the 'verbose' level.
   * @param message The verbose message.
   * @param context Optional context for the log entry.
   * @param metadata Optional additional data to include in the log entry.
   */
  verbose(message: string, context?: string, metadata?: Record<string, any>) {
    // Apply masking and sanitization before passing to Winston
    const processedMessage = this.sanitizeLogMessage(this.maskPII(message));
    const processedContext = context ? this.sanitizeLogMessage(this.maskPII(context)) : context;
    this.logger.verbose(processedMessage, { 
      context: processedContext,
      correlationId: getCurrentCorrelationId(),
      ...metadata
    });
  }
}
