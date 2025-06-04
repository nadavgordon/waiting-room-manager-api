import { Test } from '@nestjs/testing';
import { CorrelationIdMiddleware } from '../src/common/middleware/correlation-id.middleware';
import { validate as uuidValidate } from 'uuid';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CorrelationIdMiddleware],
    }).compile();

    middleware = moduleRef.get<CorrelationIdMiddleware>(CorrelationIdMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should generate a valid UUID when no correlation ID is provided', () => {
    const mockRequest = {
      headers: {},
    } as any;
    const mockResponse = {
      setHeader: jest.fn(),
    } as any;
    const mockNext = jest.fn();

    middleware.use(mockRequest, mockResponse, mockNext);

    // Check if a correlation ID was set on the request object
    expect(mockRequest.correlationId).toBeDefined();
    // Verify it's a valid UUID
    expect(uuidValidate(mockRequest.correlationId)).toBe(true);
    // Check if it was added to response headers
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID', 
      mockRequest.correlationId
    );
    // Ensure next was called
    expect(mockNext).toHaveBeenCalled();
  });

  it('should use the provided correlation ID from headers', () => {
    const testCorrelationId = '12345678-1234-1234-1234-123456789012';
    const mockRequest = {
      headers: {
        'x-correlation-id': testCorrelationId,
      },
    } as any;
    const mockResponse = {
      setHeader: jest.fn(),
    } as any;
    const mockNext = jest.fn();

    middleware.use(mockRequest, mockResponse, mockNext);

    // Check if the provided correlation ID was preserved
    expect(mockRequest.correlationId).toBe(testCorrelationId);
    // Check if it was added to response headers
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Correlation-ID', 
      testCorrelationId
    );
    // Ensure next was called
    expect(mockNext).toHaveBeenCalled();
  });

  it('should expose a static method to get correlation ID from request', () => {
    const testCorrelationId = '12345678-1234-1234-1234-123456789012';
    const mockRequest = {
      correlationId: testCorrelationId,
    } as any;

    const result = CorrelationIdMiddleware.getCorrelationId(mockRequest);
    expect(result).toBe(testCorrelationId);
  });

  it('should return undefined when request has no correlation ID', () => {
    const mockRequest = {} as any;
    const result = CorrelationIdMiddleware.getCorrelationId(mockRequest);
    expect(result).toBeUndefined();
  });
});
