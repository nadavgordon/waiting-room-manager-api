import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm'; // Repository removed as it's unused at this scope
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { RoomPlayer } from '../src/waiting-room/entities/room-player.entity';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { User } from '../src/user/entities/user.entity';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { LoggerService } from '../src/common/logger/logger.service';
import { Cache } from 'cache-manager';
import { AppDataSource } from '../src/db/data-source';
import { GameOrchestrationService } from '../src/waiting-room/game-orchestration.service'; // New service
import { RoomQueryService } from '../src/waiting-room/room-query.service'; // Dependency

// Define valid UUID constants for testing
const MOCK_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const MOCK_UNAUTHORIZED_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17';
const MOCK_NON_EXISTENT_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16';

/**
 * @file game-orchestration.service.spec.ts
 * @description Unit tests for the `GameOrchestrationService`.
 * These tests cover the logic for starting a game in a room.
 * Mocks are used for TypeORM repositories, Cache Manager, LoggerService,
 * WaitingRoomGateway, and RoomQueryService.
 */
describe('GameOrchestrationService', () => {
  let service: GameOrchestrationService;
  // let waitingRoomGateway: WaitingRoomGateway; // Removed as mockWaitingRoomGateway is used directly
  // let loggerService: LoggerService; // Removed as mockLoggerService is used directly
  // let cacheManager: Cache; // Removed as mockCacheManager is used directly
  // Removed roomRepository, roomPlayerRepository, roomQueryService, dataSource

  const mockRoomRepository = {
    save: jest.fn(),
    // findOne is not directly used by service, it uses manager.findOne in transaction
  };

  const mockRoomPlayerRepository = {
    count: jest.fn(),
    update: jest.fn(),
  };

  const mockWaitingRoomGateway = {
    emitRoomUpdate: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockCacheManager = {
    del: jest.fn(),
  };

  const mockRoomQueryService = {
    findRoomById: jest.fn(),
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
        GameOrchestrationService,
        { provide: getRepositoryToken(Room), useValue: mockRoomRepository },
        {
          provide: getRepositoryToken(RoomPlayer),
          useValue: mockRoomPlayerRepository,
        },
        { provide: WaitingRoomGateway, useValue: mockWaitingRoomGateway },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: RoomQueryService, useValue: mockRoomQueryService },
        { provide: DataSource, useValue: AppDataSource },
      ],
    }).compile();

    service = module.get<GameOrchestrationService>(GameOrchestrationService);
    // waitingRoomGateway = module.get<WaitingRoomGateway>(WaitingRoomGateway); // Removed
    // loggerService = module.get<LoggerService>(LoggerService); // No longer needed as mockLoggerService is used directly
    // cacheManager = module.get<Cache>(CACHE_MANAGER); // No longer needed as mockCacheManager is used directly
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
   * Test suite for `startGame` method.
   */
  describe('startGame', () => {
    let mockRoomDataForStartGame: Room;

    beforeEach(async () => {
      // Explicitly try to delete potentially lingering data for these specific IDs
      // before attempting to re-seed them for the startGame tests.
      if (AppDataSource.isInitialized) {
        try {
          await AppDataSource.manager.delete(RoomPlayer, {
            roomId: MOCK_ROOM_ID,
          });
          await AppDataSource.manager.delete(Room, { id: MOCK_ROOM_ID });
          await AppDataSource.manager.delete(User, { id: MOCK_HOST_ID });
          // Also attempt to delete other users that might be created in specific tests
          // to avoid conflicts if they share IDs or are not cleaned up properly.
          await AppDataSource.manager.delete(User, {
            id: MOCK_UNAUTHORIZED_HOST_ID,
          });
          await AppDataSource.manager.delete(User, {
            id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30',
          }); // pendingPlayerForStart
        } catch (e) {
          console.error(
            'Error during pre-test cleanup in startGame.beforeEach:',
            e,
          );
        }
      }

      mockRoomDataForStartGame = {
        id: MOCK_ROOM_ID,
        name: 'Start Game Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING, // Important: must be WAITING to start
        hostId: MOCK_HOST_ID,
        host: { id: MOCK_HOST_ID, username: 'hostuser' } as User,
        roomPlayers: [], // Will be populated by mocks/seeding
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Room;

      // Seed the host user and room only if DB is initialized
      if (AppDataSource.isInitialized) {
        try {
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, {
              id: MOCK_HOST_ID,
              username: 'hostuser',
              passwordHash: 'hash',
            }),
          );
          // Seed the room
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, mockRoomDataForStartGame),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      // Mock the roomQueryService.findRoomById for the end of the transaction
      // This is called to get the fully populated room for the event and return value
      mockRoomQueryService.findRoomById.mockImplementation((roomId) => {
        // Removed async
        // Return a version of the room that would reflect IN_PROGRESS status
        return Promise.resolve({
          // Ensure Promise
          ...mockRoomDataForStartGame,
          id: roomId,
          status: RoomStatus.IN_PROGRESS,
        } as Room);
      });
      mockCacheManager.del.mockResolvedValue(undefined);
    });

    /**
     * Test case: Should start the game if the host is authorized and the room is in WAITING status.
     */
    it('should start the game if host is authorized and room is waiting', async () => {
      // Seed an active player (host is usually one, but explicit count is used)
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_HOST_ID,
          status: RoomPlayerStatus.ACTIVE,
        }),
      );
      // Seed a pending player to check if they get declined
      const pendingPlayerUser = await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30',
          username: 'pendingPlayerForStart',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: pendingPlayerUser.id,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      const result = await service.startGame(MOCK_ROOM_ID, MOCK_HOST_ID);

      expect(result.status).toBe(RoomStatus.IN_PROGRESS);

      const roomInDb = await AppDataSource.manager.findOneBy(Room, {
        id: MOCK_ROOM_ID,
      });
      expect(roomInDb?.status).toBe(RoomStatus.IN_PROGRESS);

      const pendingPlayerInDb = await AppDataSource.manager.findOneBy(
        RoomPlayer,
        { roomId: MOCK_ROOM_ID, userId: pendingPlayerUser.id },
      );
      expect(pendingPlayerInDb?.status).toBe(RoomPlayerStatus.DECLINED);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        // Use mockWaitingRoomGateway
        expect.objectContaining({ status: RoomStatus.IN_PROGRESS }),
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Host ${MOCK_HOST_ID} attempting to start game in room: ${MOCK_ROOM_ID}`,
        'GameOrchestrationService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Game started in room ${MOCK_ROOM_ID}. Status set to IN_PROGRESS.`,
        'GameOrchestrationService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `All pending join requests for room ${MOCK_ROOM_ID} declined.`,
        'GameOrchestrationService',
      );
    });

    /**
     * Test case: Should throw ForbiddenException if the user is not the host.
     */
    it('should throw ForbiddenException if not host', async () => {
      // MOCK_UNAUTHORIZED_HOST_ID is not the host of mockRoomDataForStartGame
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_UNAUTHORIZED_HOST_ID,
          username: 'unauthHostStart',
          passwordHash: 'hash',
        }),
      );

      await expect(
        service.startGame(MOCK_ROOM_ID, MOCK_UNAUTHORIZED_HOST_ID),
      ).rejects.toThrow(
        new ForbiddenException('Only the host can start the game.'),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Forbidden: Host ${MOCK_UNAUTHORIZED_HOST_ID} attempted to start game in room ${MOCK_ROOM_ID} which they do not own.`,
        'GameOrchestrationService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the room is not in WAITING status.
     */
    it('should throw BadRequestException if room is not in WAITING status', async () => {
      // Update the seeded room to be IN_PROGRESS
      await AppDataSource.manager.update(Room, MOCK_ROOM_ID, {
        status: RoomStatus.IN_PROGRESS,
      });

      await expect(
        service.startGame(MOCK_ROOM_ID, MOCK_HOST_ID),
      ).rejects.toThrow(
        new BadRequestException(
          `Game cannot be started. Room status is currently '${RoomStatus.IN_PROGRESS}'.`,
        ),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Game cannot be started in room ${MOCK_ROOM_ID}. Current status: ${RoomStatus.IN_PROGRESS}.`,
        'GameOrchestrationService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if there are no active players in the room.
     */
    it('should throw BadRequestException if no active players in room', async () => {
      // Ensure no active players are seeded for this room for this test
      await AppDataSource.manager.delete(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        status: RoomPlayerStatus.ACTIVE,
      });

      await expect(
        service.startGame(MOCK_ROOM_ID, MOCK_HOST_ID),
      ).rejects.toThrow(
        new BadRequestException('Cannot start a game with no players.'),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Cannot start game in room ${MOCK_ROOM_ID}: No active players.`,
        'GameOrchestrationService',
      );
    });

    /**
     * Test case: Should throw NotFoundException if room not found.
     */
    it('should throw NotFoundException if room not found', async () => {
      // MOCK_NON_EXISTENT_ROOM_ID is not seeded
      await expect(
        service.startGame(MOCK_NON_EXISTENT_ROOM_ID, MOCK_HOST_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found`,
        ),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found.`,
        'GameOrchestrationService',
      );
    });
  });
});
