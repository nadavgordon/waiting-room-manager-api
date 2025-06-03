import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
// import { Repository } from 'typeorm'; // Repository removed as it's unused at this scope
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { User } from '../src/user/entities/user.entity'; // Keep for Room.host relation if tested
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { LoggerService } from '../src/common/logger/logger.service';
import { Cache } from 'cache-manager';
import { AppDataSource } from '../src/db/data-source';
import { RoomQueryService } from '../src/waiting-room/room-query.service'; // New service
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum'; // For findAllRooms test data

// Define valid UUID constants for testing (can be trimmed down if not all are used)
const MOCK_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const MOCK_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
const MOCK_NON_EXISTENT_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16';
const MOCK_ANOTHER_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18';

/**
 * @file room-query.service.spec.ts
 * @description Unit tests for the `RoomQueryService`.
 * These tests cover the logic for querying room data,
 * including finding rooms by ID and listing all rooms with filtering.
 * Mocks are used for TypeORM repositories, Cache Manager, and LoggerService.
 */
describe('RoomQueryService', () => {
  let service: RoomQueryService;
  // let roomRepository: Repository<Room>;
  // let loggerService: LoggerService; // Removed as mockLoggerService is used directly
  // let cacheManager: Cache; // Removed as mockCacheManager is used directly

  const queryBuilderMock = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockRoomRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => queryBuilderMock), // Return the defined mock object
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      try {
        await AppDataSource.initialize();
        console.log('Test database connection initialized successfully');
      } catch (error) {
        console.error('Error initializing test database connection:', error);
      }
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.destroy();
        console.log('Test database connection closed successfully');
      } catch (error) {
        console.error('Error closing test database connection:', error);
      }
    }
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomQueryService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRoomRepository,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
        // DataSource might not be directly injected into RoomQueryService constructor,
        // but AppDataSource is used for global setup/teardown and afterEach cleanup.
      ],
    }).compile();

    service = module.get<RoomQueryService>(RoomQueryService);
    // roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room)); // No longer needed here
    // loggerService = module.get<LoggerService>(LoggerService); // Removed
    // cacheManager = module.get<Cache>(CACHE_MANAGER); // Removed
  });

  afterEach(async () => {
    jest.clearAllMocks();
    // Only attempt database cleanup if connection is initialized
    if (AppDataSource.isInitialized) {
      try {
        await AppDataSource.manager.query('DELETE FROM "room_players";');
        await AppDataSource.manager.query('DELETE FROM "rooms";');
        await AppDataSource.manager.query('DELETE FROM "users";');
      } catch (error) {
        console.error('Error cleaning up test data:', error);
      }
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * Test suite for `findRoomById` method.
   */
  describe('findRoomById', () => {
    /**
     * Test case: Should return a room if found in the database.
     * Verifies that the service can retrieve a room by its ID, including related entities.
     */
    it('should return a room if found', async () => {
      const mockRoom = {
        id: MOCK_ROOM_ID,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_HOST_ID,
        host: {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);
      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss

      const result = await service.findRoomById(MOCK_ROOM_ID);
      expect(result).toEqual(mockRoom);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: MOCK_ROOM_ID },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Attempting to find room by ID: ${MOCK_ROOM_ID}`,
        'RoomQueryService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Room found with ID: ${MOCK_ROOM_ID} and cached.`,
        'RoomQueryService',
      );
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        // Use mockCacheManager directly
        `room_${MOCK_ROOM_ID}`,
        mockRoom,
      );
    });

    /**
     * Test case: Should throw NotFoundException if the room is not found.
     * Ensures that an appropriate exception is thrown for non-existent room IDs.
     */
    it('should throw NotFoundException if room not found', async () => {
      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss
      mockRoomRepository.findOne.mockResolvedValue(null); // Simulate room not found in DB
      await expect(
        service.findRoomById(MOCK_NON_EXISTENT_ROOM_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found.`,
        'RoomQueryService',
      );
    });

    /**
     * Test case: Should return a room from cache if available.
     * Verifies that the service prioritizes fetching from cache if the data is present.
     */
    it('should return a room from cache if available', async () => {
      const mockRoom = {
        id: MOCK_ROOM_ID,
        name: 'Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_HOST_ID,
        host: {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(mockRoom); // Simulate cache hit
      // roomRepository.findOne should NOT be called if cache hits
      // mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      const result = await service.findRoomById(MOCK_ROOM_ID);
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`);
      expect(mockRoomRepository.findOne).not.toHaveBeenCalled(); // Verify cache hit, DB not queried
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Room with ID: ${MOCK_ROOM_ID} found in cache.`,
        'RoomQueryService',
      );
    });

    /**
     * Test case: Should cache the room if not found in cache but found in DB.
     * Verifies that the service caches the room after fetching it from the database.
     */
    it('should cache the room if not found in cache', async () => {
      const mockRoom = {
        id: MOCK_ROOM_ID,
        name: 'New Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_HOST_ID,
        host: {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss
      mockRoomRepository.findOne.mockResolvedValue(mockRoom); // Simulate DB hit
      mockCacheManager.set.mockResolvedValue(undefined); // Mock cache set operation

      const result = await service.findRoomById(MOCK_ROOM_ID);
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: MOCK_ROOM_ID },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        `room_${MOCK_ROOM_ID}`,
        mockRoom,
      ); // Verify caching
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Room found with ID: ${MOCK_ROOM_ID} and cached.`,
        'RoomQueryService',
      );
    });
  });

  /**
   * Test suite for `findAllRooms` method.
   */
  describe('findAllRooms', () => {
    /**
     * Test case: Should return paginated public rooms if no userId is provided (anonymous access).
     * Verifies that only public rooms are returned when the request is unauthenticated.
     */
    it('should return paginated public rooms if no userId is provided', async () => {
      const mockRooms = [
        {
          id: MOCK_ROOM_ID,
          name: 'Public Room 1',
          isPublic: true,
          approvalRequired: false,
          maxPlayers: 10,
          status: RoomStatus.WAITING,
          hostId: MOCK_HOST_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', // New UUID for a different room
          name: 'Public Room 2',
          isPublic: true,
          approvalRequired: false,
          maxPlayers: 10,
          status: RoomStatus.WAITING,
          hostId: MOCK_ANOTHER_HOST_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Room[];
      const total = 2;
      mockRoomRepository
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([mockRooms, total]);

      // Passing null or undefined for userId to simulate anonymous user
      const result = await service.findAllRooms(null as any, 1, 10);
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(queryBuilderMock.where) // Use the direct mock object
        .toHaveBeenCalledWith('room.isPublic = :isPublicTrue', {
          isPublicTrue: true,
        });
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        'Querying for public rooms only (anonymous user).',
        'RoomQueryService',
      );
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0); // Use the direct mock object
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10); // Use the direct mock object
    });

    /**
     * Test case: Should return paginated public rooms and rooms where the user is host or an active player if userId is provided.
     * Verifies that authenticated users see public rooms, their hosted rooms, and rooms they are active in.
     */
    it('should return paginated public rooms and rooms where user is host or active player if userId is provided', async () => {
      const userId = MOCK_USER_ID;
      const mockRooms = [
        {
          id: MOCK_ROOM_ID,
          name: 'Public Room 1',
          isPublic: true,
          approvalRequired: false,
          maxPlayers: 10,
          status: RoomStatus.WAITING,
          hostId: MOCK_HOST_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
          name: 'Private Room Host',
          isPublic: false,
          approvalRequired: true,
          maxPlayers: 10,
          status: RoomStatus.WAITING,
          hostId: userId,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Room[];
      const total = 2;
      mockRoomRepository
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms(userId, 1, 10);
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(queryBuilderMock.where) // Use the direct mock object
        .toHaveBeenCalledWith('room.isPublic = :isPublicTrue', {
          isPublicTrue: true,
        });
      expect(queryBuilderMock.orWhere) // Use the direct mock object
        .toHaveBeenCalledWith('room.hostId = :currentUserId', {
          currentUserId: userId,
        });
      expect(queryBuilderMock.orWhere).toHaveBeenNthCalledWith(
        // Use the direct mock object
        2, // Check the second call to orWhere
        'roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus',
        expect.objectContaining({
          // Make the parameter check less strict
          currentUserId: userId,
          activeStatus: RoomPlayerStatus.ACTIVE,
        }),
      );
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Querying for public rooms or rooms where user ${userId} is host/active player.`,
        'RoomQueryService',
      );
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(0); // Use the direct mock object
      expect(queryBuilderMock.take).toHaveBeenCalledWith(10); // Use the direct mock object
    });

    /**
     * Test case: Should handle different page and limit values for pagination.
     * Verifies that pagination parameters are correctly applied to the query.
     */
    it('should handle different page and limit values', async () => {
      const userId = MOCK_USER_ID;
      const mockRooms = [
        {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', // New UUID
          name: 'Public Room 3',
          isPublic: true,
          approvalRequired: false,
          maxPlayers: 10,
          status: RoomStatus.WAITING,
          hostId: MOCK_ANOTHER_HOST_ID,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as Room[];
      const total = 5;
      mockRoomRepository
        .createQueryBuilder()
        .getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms(userId, 2, 1); // Page 2, limit 1
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(queryBuilderMock.skip).toHaveBeenCalledWith(1); // Use the direct mock object
      expect(queryBuilderMock.take).toHaveBeenCalledWith(1); // Use the direct mock object
    });
  });
});
