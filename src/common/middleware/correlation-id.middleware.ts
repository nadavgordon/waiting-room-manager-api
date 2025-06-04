import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Extend Express Request to include correlationId
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
import { v4 as uuidv4 } from 'uuid';

/**
 * CorrelationIdMiddleware adds a unique correlation ID to each request.
 * 
 * This middleware ensures end-to-end request tracking across services and logs, which is
 * crucial for debugging distributed systems and tracing request flows through the application.
 * The correlation ID is added to the request object and can be included in logs, responses,
 * and forwarded to downstream services.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  /**
   * Header name used for the correlation ID in both requests and responses
   */
  private static readonly CORRELATION_ID_HEADER = 'X-Correlation-ID';
  
  /**
   * Namespace key used for storing the correlation ID in the request object
   */
  public static readonly CORRELATION_ID_KEY = 'correlationId';

  /**
   * Processes each incoming request by adding a correlation ID
   * @param req The incoming request object
   * @param res The outgoing response object
   * @param next The next middleware function
   */
  use(req: Request, res: Response, next: NextFunction): void {
    // Check if a correlation ID was provided in the request headers
    const headerCorrelationId = req.headers[CorrelationIdMiddleware.CORRELATION_ID_HEADER.toLowerCase()] as string || 
                              (req.header && typeof req.header === 'function' ? req.header(CorrelationIdMiddleware.CORRELATION_ID_HEADER) : undefined);
    
    // Use the provided correlation ID or generate a new one
    const correlationId = headerCorrelationId || uuidv4();
    
    // Add the correlation ID to the request object for use in other middleware/controllers
    req.correlationId = correlationId;
    
    // Add the correlation ID to response headers to support end-to-end tracking
    // Support both Express Response.set() and Response.setHeader() methods
    if (typeof res.set === 'function') {
      res.set(CorrelationIdMiddleware.CORRELATION_ID_HEADER, correlationId);
    } else if (typeof res.setHeader === 'function') {
      res.setHeader(CorrelationIdMiddleware.CORRELATION_ID_HEADER, correlationId);
    }
    
    next();
  }

  /**
   * Extracts the correlation ID from a request object
   * @param request The request object containing the correlation ID
   * @returns The correlation ID string or undefined if not found
   */
  public static getCorrelationId(request: Request): string | undefined {
    return request.correlationId;
  }
}