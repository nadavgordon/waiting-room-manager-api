import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from '../src/cache/cache.service';
import { LoggerService } from '../src/common/logger/logger.service';

// Create mock implementations
const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  store: {
    keys: jest.fn().mockResolvedValue([]),
    getClient: jest.fn(),
  },
};

// Mock implementation for the delByPattern method to make tests pass
const mockDelByPattern = async (pattern: string): Promise<void> => {
  const allKeys = await mockCacheManager.store.keys() as string[];
  const matchingKeys = allKeys.filter((key: string) => key.startsWith(pattern.replace('*', '')));
  for (const key of matchingKeys) {
    await mockCacheManager.del(key);
  }
};

const mockLogger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
};

// Mock Redis client for testing connection handling
const mockRedisClient = {
  quit: jest.fn().mockImplementation((cb) => {
    if (cb) cb();
    return Promise.resolve('OK');
  }),
  on: jest.fn(),
};

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Configure the mock Redis client
    mockCacheManager.store.getClient.mockReturnValue(mockRedisClient);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    cacheService = moduleRef.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(cacheService).toBeDefined();
  });

  describe('get', () => {
    it('should get an item from cache and return it', async () => {
      const key = 'test-key';
      const expectedValue = { foo: 'bar' };
      mockCacheManager.get.mockResolvedValue(expectedValue);

      const result = await cacheService.get<{foo: string}>(key);
      
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(result).toEqual(expectedValue);
    });

    it('should log error and return undefined on cache retrieval failure', async () => {
      const key = 'error-key';
      const testError = new Error('Cache get error');
      mockCacheManager.get.mockRejectedValue(testError);

      const result = await cacheService.get<any>(key);
      
      expect(mockCacheManager.get).toHaveBeenCalledWith(key);
      expect(mockLogger.error).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('set', () => {
    it('should set an item in cache with provided TTL', async () => {
      const key = 'test-key';
      const value = { foo: 'bar' };
      const ttl = 3600;
      mockCacheManager.set.mockResolvedValue(undefined);

      await cacheService.set(key, value, ttl);
      
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, ttl);
    });

    it('should set an item with default TTL when not specified', async () => {
      const key = 'test-key';
      const value = { foo: 'bar' };
      mockCacheManager.set.mockResolvedValue(undefined);

      await cacheService.set(key, value);
      
      // Default TTL should be used (actual value depends on implementation)
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, expect.any(Number));
    });

    it('should log error on cache set failure', async () => {
      const key = 'error-key';
      const value = { foo: 'bar' };
      const testError = new Error('Cache set error');
      mockCacheManager.set.mockRejectedValue(testError);

      await cacheService.set(key, value);
      
      expect(mockCacheManager.set).toHaveBeenCalledWith(key, value, expect.any(Number));
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('del', () => {
    it('should delete an item from cache', async () => {
      const key = 'test-key';
      mockCacheManager.del.mockResolvedValue(undefined);

      await cacheService.del(key);
      
      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
    });

    it('should log error on cache delete failure', async () => {
      const key = 'error-key';
      const testError = new Error('Cache delete error');
      mockCacheManager.del.mockRejectedValue(testError);

      await cacheService.del(key);
      
      expect(mockCacheManager.del).toHaveBeenCalledWith(key);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('delByPattern', () => {
    beforeEach(() => {
      // Reset mock functions before each test
      jest.clearAllMocks();
      // Reset any rejections from previous tests
      mockCacheManager.del.mockReset();
      mockCacheManager.store.keys.mockReset();
    });

    it('should delete multiple items matching a pattern', async () => {
      // Mock implementation for this specific test
      const pattern = 'test:*';
      const matchingKeys = ['test:1', 'test:2', 'test:3'];
      
      // Setup mocks
      mockCacheManager.store.keys.mockResolvedValueOnce(matchingKeys);
      mockCacheManager.del.mockResolvedValue(undefined); // Ensure successful deletion
      
      // Create a spy on CacheService.delByPattern to ensure it runs our expected logic
      const spy = jest.spyOn(cacheService, 'delByPattern');
      
      await cacheService.delByPattern(pattern);
      
      // Verify method was called
      expect(spy).toHaveBeenCalledWith(pattern);
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
      
      // Should call del for each matching key
      expect(mockCacheManager.del).toHaveBeenCalledTimes(matchingKeys.length);
      matchingKeys.forEach(key => {
        expect(mockCacheManager.del).toHaveBeenCalledWith(key);
      });
      
      spy.mockRestore();
    });

    it('should filter keys correctly based on pattern', async () => {
      const pattern = 'user:*';
      const allKeys = ['user:1', 'user:2', 'room:1', 'room:2'];
      const expectedKeys = ['user:1', 'user:2'];
      
      // Setup mocks - ensure successful operations
      mockCacheManager.store.keys.mockResolvedValueOnce(allKeys);
      mockCacheManager.del.mockResolvedValue(undefined);
      
      // Create a spy to verify method call
      const spy = jest.spyOn(cacheService, 'delByPattern');
      
      await cacheService.delByPattern(pattern);
      
      expect(spy).toHaveBeenCalledWith(pattern);
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
      
      // Should only delete keys matching the pattern
      expect(mockCacheManager.del).toHaveBeenCalledTimes(expectedKeys.length);
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:1');
      expect(mockCacheManager.del).toHaveBeenCalledWith('user:2');
      
      spy.mockRestore();
    });

    it('should handle errors when getting keys', async () => {
      const pattern = 'test:*';
      const testError = new Error('Cache keys error');
      
      // Setup mocks
      mockCacheManager.store.keys.mockRejectedValueOnce(testError);
      mockLogger.error.mockClear();
      
      // This should not throw errors as our implementation catches them
      await cacheService.delByPattern(pattern);
      
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockCacheManager.del).not.toHaveBeenCalled();
    });
    
    it('should handle errors when deleting individual keys', async () => {
      const pattern = 'test:*';
      const matchingKeys = ['test:1', 'test:2', 'test:3'];
      const deleteError = new Error('Cache delete error');
      
      // Set up mocks with successful keys retrieval but failed deletion
      mockCacheManager.store.keys.mockResolvedValueOnce(matchingKeys);
      mockCacheManager.del.mockRejectedValue(deleteError); // All deletions will fail
      mockLogger.error.mockClear();
      
      // This should not throw errors as our implementation catches them
      await cacheService.delByPattern(pattern);
      
      // Verify expectations
      expect(mockCacheManager.store.keys).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockCacheManager.del).toHaveBeenCalledTimes(matchingKeys.length);
    });
  });

  describe('onModuleDestroy', () => {
    it('should gracefully shut down Redis connection', async () => {
      await cacheService.onModuleDestroy();
      
      expect(mockCacheManager.store.getClient).toHaveBeenCalled();
      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith(
        expect.stringContaining('Redis connection closed'),
        expect.any(String)
      );
    });

    it('should log error when Redis shutdown fails', async () => {
      const testError = new Error('Redis shutdown error');
      mockRedisClient.quit.mockRejectedValueOnce(testError);

      await cacheService.onModuleDestroy();
      
      expect(mockCacheManager.store.getClient).toHaveBeenCalled();
      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
