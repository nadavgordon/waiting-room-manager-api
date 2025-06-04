import { Test } from '@nestjs/testing';
import { LoggerService, runWithCorrelationId, getCurrentCorrelationId, setCurrentCorrelationId } from '../src/common/logger/logger.service';
import * as winston from 'winston';

// Mock Winston's createLogger to capture log calls
jest.mock('winston', () => {
  const originalModule = jest.requireActual('winston');
  const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  return {
    ...originalModule,
    createLogger: jest.fn(() => mockLogger),
    format: {
      ...originalModule.format,
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      printf: jest.fn(),
      colorize: jest.fn(),
    },
    transports: {
      Console: jest.fn(),
    },
  };
});

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockWinstonLogger: any;

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    loggerService = moduleRef.get<LoggerService>(LoggerService);
    mockWinstonLogger = (winston.createLogger as jest.Mock).mock.results[0].value;
  });

  it('should be defined', () => {
    expect(loggerService).toBeDefined();
  });

  it('should log at info level with context', () => {
    const message = 'Test info message';
    const context = 'TestContext';
    
    loggerService.log(message, context);
    
    expect(mockWinstonLogger.info).toHaveBeenCalled();
    // Verify the first argument is the processed message
    expect(mockWinstonLogger.info.mock.calls[0][0]).toBe(message);
    // Verify context is in the metadata
    expect(mockWinstonLogger.info.mock.calls[0][1].context).toBe(context);
  });

  it('should log at error level with trace and context', () => {
    const message = 'Test error message';
    const trace = 'Error stack trace';
    const context = 'ErrorContext';
    
    loggerService.error(message, trace, context);
    
    expect(mockWinstonLogger.error).toHaveBeenCalled();
    expect(mockWinstonLogger.error.mock.calls[0][0]).toBe(message);
    expect(mockWinstonLogger.error.mock.calls[0][1].trace).toBe(trace);
    expect(mockWinstonLogger.error.mock.calls[0][1].context).toBe(context);
  });

  it('should log with correlation ID when one is set', () => {
    const testCorrelationId = 'test-correlation-id';
    const message = 'Test with correlation ID';
    
    // Run test within a correlation ID context
    runWithCorrelationId(testCorrelationId, () => {
      loggerService.log(message);
      
      expect(mockWinstonLogger.info).toHaveBeenCalled();
      expect(mockWinstonLogger.info.mock.calls[0][1].correlationId).toBe(testCorrelationId);
    });
  });

  it('should include additional metadata in log entries', () => {
    const message = 'Test with metadata';
    const metadata = { 
      userId: '123', 
      action: 'login',
      timestamp: new Date().toISOString()
    };
    
    loggerService.log(message, 'Context', metadata);
    
    expect(mockWinstonLogger.info).toHaveBeenCalled();
    expect(mockWinstonLogger.info.mock.calls[0][1].userId).toBe(metadata.userId);
    expect(mockWinstonLogger.info.mock.calls[0][1].action).toBe(metadata.action);
    expect(mockWinstonLogger.info.mock.calls[0][1].timestamp).toBe(metadata.timestamp);
  });

  it('should mask PII data in log messages', () => {
    const messageWithPII = 'User email is test@example.com and password is secret123';
    
    loggerService.log(messageWithPII);
    
    // The exact masking implementation may vary, but we expect PII to be masked
    expect(mockWinstonLogger.info).toHaveBeenCalled();
    // This test assumes the maskPII method exists and works - we're checking that
    // the passed message differs from the original message with PII
    // You would need to adapt this based on your actual masking implementation
    const processedMessage = mockWinstonLogger.info.mock.calls[0][0];
    expect(processedMessage).not.toContain('secret123'); 
    // Further assertions would depend on your PII masking logic
  });
});

describe('Correlation ID utilities', () => {
  beforeEach(() => {
    // Reset AsyncLocalStorage state between tests
    setCurrentCorrelationId(null as unknown as string);
  });

  it('should get and set correlation IDs using AsyncLocalStorage', () => {
    const testCorrelationId = 'test-correlation-id';
    
    // Initially, no correlation ID is set
    expect(getCurrentCorrelationId()).toBeNull();
    
    // Set a correlation ID
    setCurrentCorrelationId(testCorrelationId);
    
    // Verify it can be retrieved
    expect(getCurrentCorrelationId()).toBe(testCorrelationId);
  });

  it('should execute function with correlation ID context', () => {
    const testCorrelationId = 'context-test-id';
    
    const result = runWithCorrelationId(testCorrelationId, () => {
      // Inside this function, the correlation ID should be available
      expect(getCurrentCorrelationId()).toBe(testCorrelationId);
      return 'test-result';
    });
    
    // Function should execute and return its result
    expect(result).toBe('test-result');
    
    // Outside the function, the correlation ID should not be available
    expect(getCurrentCorrelationId()).toBeNull();
  });

  it('should maintain correlation ID across async operations', async () => {
    const testCorrelationId = 'async-test-id';
    
    await runWithCorrelationId(testCorrelationId, async () => {
      // Initial check
      expect(getCurrentCorrelationId()).toBe(testCorrelationId);
      
      // Check after an async operation
      await Promise.resolve();
      expect(getCurrentCorrelationId()).toBe(testCorrelationId);
      
      // Check inside nested Promise
      await new Promise<void>(resolve => {
        expect(getCurrentCorrelationId()).toBe(testCorrelationId);
        resolve();
      });
    });
    
    // Outside the context, ID should not be available
    expect(getCurrentCorrelationId()).toBeNull();
  });
});
