import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm'; // Repository removed as it's unused at this scope
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { RoomPlayer } from '../src/waiting-room/entities/room-player.entity';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { User } from '../src/user/entities/user.entity';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { LoggerService } from '../src/common/logger/logger.service';
import { Cache } from 'cache-manager';
import { AppDataSource } from '../src/db/data-source';
import { RoomManagementService } from '../src/waiting-room/room-management.service'; // New service
import { RoomQueryService } from '../src/waiting-room/room-query.service'; // Dependency

// Define valid UUID constants for testing
const MOCK_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const MOCK_NON_EXISTENT_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15';
const MOCK_NON_EXISTENT_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16';
const MOCK_UNAUTHORIZED_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17';

/**
 * @file room-management.service.spec.ts
 * @description Unit tests for the `RoomManagementService`.
 * These tests cover the core logic for creating, updating, and deleting rooms.
 * Mocks are used for TypeORM repositories, Cache Manager, LoggerService,
 * WaitingRoomGateway, and RoomQueryService.
 */
describe('RoomManagementService', () => {
  let service: RoomManagementService;
  // Unused top-level variables will be removed or used via their mock instances
  // let roomRepository: Repository<Room>;
  // let roomPlayerRepository: Repository<RoomPlayer>;
  // let userRepository: Repository<User>;
  let waitingRoomGateway: WaitingRoomGateway;
  // loggerService and cacheManager will be obtained from module.get in beforeEach
  // and will point to mockLoggerService and mockCacheManager respectively.
  // let roomQueryService: RoomQueryService;
  let dataSource: DataSource;

  const mockRoomRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
  };

  const mockRoomPlayerRepository = {
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };

  const mockUserRepository = {
    findOneBy: jest.fn(),
  };

  const mockWaitingRoomGateway = {
    // This is the actual mock object
    emitRoomUpdate: jest.fn(),
  };

  const mockLoggerService = {
    // This is the actual mock object
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const mockCacheManager = {
    // This is the actual mock object
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  const mockRoomQueryService = {
    // This is the actual mock object
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
        RoomManagementService,
        { provide: getRepositoryToken(Room), useValue: mockRoomRepository },
        {
          provide: getRepositoryToken(RoomPlayer),
          useValue: mockRoomPlayerRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: WaitingRoomGateway, useValue: mockWaitingRoomGateway },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: RoomQueryService, useValue: mockRoomQueryService },
        { provide: DataSource, useValue: AppDataSource }, // Provide the actual DataSource for transactions
      ],
    }).compile();

    service = module.get<RoomManagementService>(RoomManagementService);
    // roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room)); // Not assigned if using mock directly
    // roomPlayerRepository = module.get<Repository<RoomPlayer>>(getRepositoryToken(RoomPlayer)); // Not assigned
    // userRepository = module.get<Repository<User>>(getRepositoryToken(User)); // Not assigned
    waitingRoomGateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
    // loggerService = module.get<LoggerService>(LoggerService); // No longer needed as mockLoggerService is used directly
    // cacheManager = module.get<Cache>(CACHE_MANAGER); // No longer needed as mockCacheManager is used directly
    // roomQueryService = module.get<RoomQueryService>(RoomQueryService);
    dataSource = module.get<DataSource>(DataSource);
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
   * Test suite for `createRoom` method.
   */
  describe('createRoom', () => {
    /**
     * Test case: Should successfully create a room and add the host as an active player.
     * Verifies that the service correctly interacts with repositories and gateway
     * to create a room and set the host's status.
     */
    it('should successfully create a room and add host as active player', async () => {
      const hostUserDetails = {
        id: MOCK_HOST_ID,
        username: 'hostForCreateSuccess',
        passwordHash: 'password123',
      };
      // Ensure user exists for the transaction, but only if DB connection is initialized
      if (AppDataSource.isInitialized) {
        try {
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, hostUserDetails),
          );
        } catch (error) {
          console.error('Error seeding test user data:', error);
        }
      }

      const createRoomDto = {
        name: 'Test Room For Success',
        maxPlayers: 4,
        isPublic: true,
        approvalRequired: false,
      };

      // The room object that roomQueryService.findRoomById is expected to return
      // This will be called with the actual ID generated by the DB within createRoom's transaction.
      const expectedRoomAfterCreation = {
        id: expect.any(String), // This will be the actual ID from DB
        name: createRoomDto.name,
        maxPlayers: createRoomDto.maxPlayers,
        isPublic: createRoomDto.isPublic ?? true,
        approvalRequired: createRoomDto.approvalRequired ?? false,
        hostId: MOCK_HOST_ID,
        status: RoomStatus.WAITING,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        version: 1,
        host: {
          id: MOCK_HOST_ID,
          username: hostUserDetails.username,
        },
        roomPlayers: [
          {
            id: expect.any(String),
            roomId: expect.any(String), // Will match the room's ID
            userId: MOCK_HOST_ID,
            status: RoomPlayerStatus.ACTIVE,
            player: {
              id: MOCK_HOST_ID,
              username: hostUserDetails.username,
            },
          },
        ],
      };

      // Mock roomQueryService.findRoomById
      // It will be called with the ID of the newly saved room.
      mockRoomQueryService.findRoomById.mockImplementation((roomId) => {
        // Removed async as no await inside
        return Promise.resolve({
          // Ensure it returns a Promise if the original is async
          ...expectedRoomAfterCreation,
          id: roomId,
          roomPlayers: [
            {
              ...expectedRoomAfterCreation.roomPlayers[0],
              roomId: roomId,
            },
          ],
        } as unknown as Room);
      });

      const result = await service.createRoom(createRoomDto, MOCK_HOST_ID);

      expect(result).toBeDefined();
      expect(result.name).toEqual(createRoomDto.name);
      expect(result.hostId).toEqual(MOCK_HOST_ID);
      expect(result.status).toEqual(RoomStatus.WAITING);
      const actualRoomId = result.id; // Get the actual ID from the result
      expect(actualRoomId).toEqual(expect.any(String));

      // Verify roomQueryService.findRoomById was called with the correct ID
      expect(mockRoomQueryService.findRoomById).toHaveBeenCalledWith(
        actualRoomId,
      );

      // Verify DB state
      const roomInDb = await AppDataSource.manager.findOne(Room, {
        where: { id: actualRoomId },
        relations: ['host'],
      });
      expect(roomInDb).toBeDefined();
      expect(roomInDb?.name).toBe(createRoomDto.name);
      expect(roomInDb?.host?.id).toBe(MOCK_HOST_ID);

      const roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: actualRoomId,
        userId: MOCK_HOST_ID,
      });
      expect(roomPlayerInDb).toBeDefined();
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.ACTIVE);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: actualRoomId }),
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Attempting to create room for host: ${MOCK_HOST_ID}`,
        'RoomManagementService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        expect.stringContaining(
          `Room created with ID: ${actualRoomId} by host: ${MOCK_HOST_ID}`,
        ),
        'RoomManagementService',
      );
    });

    it('should throw NotFoundException if host not found', async () => {
      // userRepository.findOneBy is mocked in beforeEach, but for transactions,
      // the actual DB call via AppDataSource.manager.findOneBy will occur.
      // So, we ensure the user does NOT exist in the DB for this test.
      // MOCK_NON_EXISTENT_HOST_ID is not seeded.

      const createRoomDto = {
        name: 'Test Room Host Not Found',
        maxPlayers: 4,
      };
      const hostId = MOCK_NON_EXISTENT_HOST_ID;

      await expect(service.createRoom(createRoomDto, hostId)).rejects.toThrow(
        new NotFoundException(`Host with ID "${hostId}" not found.`),
      );

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Host with ID "${hostId}" not found during room creation.`,
        'RoomManagementService',
      );
    });
  });

  /**
   * Test suite for `updateRoom` method.
   */
  describe('updateRoom', () => {
    /**
     * Test case: Should update a room if the host is authorized.
     * Verifies that the room details can be updated by its host, and cache is invalidated.
     */
    it('should update a room if host is authorized', async () => {
      const roomId = MOCK_ROOM_ID;
      const hostId = MOCK_HOST_ID;
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Old Name',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const updatedRoomData = { ...existingRoom, ...updateRoomDto };

      // Mock the call to roomQueryService.findRoomById
      mockRoomQueryService.findRoomById.mockResolvedValue(existingRoom);
      mockRoomRepository.save.mockResolvedValue(updatedRoomData);
      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.updateRoom(roomId, updateRoomDto, hostId);

      expect(mockRoomQueryService.findRoomById).toHaveBeenCalledWith(roomId);
      expect(result).toEqual(updatedRoomData);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(updateRoomDto),
      );
      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        updatedRoomData,
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Use mockCacheManager
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Attempting to update room ${roomId} by host: ${hostId}`,
        'RoomManagementService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Room ${roomId} updated successfully by host: ${hostId}`,
        'RoomManagementService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Cache for room ${roomId} invalidated due to update.`,
        'RoomManagementService',
      );
    });

    /**
     * Test case: Should throw ForbiddenException if the host is not authorized.
     * Ensures that only the room host can update room details.
     */
    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = MOCK_ROOM_ID;
      const unauthorizedHostId = MOCK_UNAUTHORIZED_HOST_ID;
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = {
        id: roomId,
        hostId: MOCK_HOST_ID, // Original host
        name: 'Old Name',
      } as Room;

      mockRoomQueryService.findRoomById.mockResolvedValue(existingRoom);

      await expect(
        service.updateRoom(roomId, updateRoomDto, unauthorizedHostId),
      ).rejects.toThrow(ForbiddenException);

      expect(mockRoomQueryService.findRoomById).toHaveBeenCalledWith(roomId);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Forbidden: Host ${unauthorizedHostId} attempted to update room ${roomId} which they do not own.`,
        'RoomManagementService',
      );
    });

    // Test for NotFoundException if roomQueryService.findRoomById throws it
    it('should throw NotFoundException if room not found during update', async () => {
      const roomId = MOCK_NON_EXISTENT_ROOM_ID;
      const hostId = MOCK_HOST_ID;
      const updateRoomDto = { name: 'Updated Room' };

      mockRoomQueryService.findRoomById.mockRejectedValue(
        new NotFoundException(`Room with ID "${roomId}" not found`),
      );

      await expect(
        service.updateRoom(roomId, updateRoomDto, hostId),
      ).rejects.toThrow(NotFoundException);
      expect(mockRoomQueryService.findRoomById).toHaveBeenCalledWith(roomId);
    });
  });

  /**
   * Test suite for `deleteRoom` method.
   */
  describe('deleteRoom', () => {
    /**
     * Test case: Should delete a room if the host is authorized.
     * Verifies that the room and its associated players are removed, and cache is invalidated.
     */
    it('should delete a room if host is authorized', async () => {
      // const roomId = MOCK_ROOM_ID; // roomId in this scope is unused if MOCK_ROOM_ID is used directly
      const hostUserDetails = {
        id: MOCK_HOST_ID,
        username: 'host-for-delete',
        passwordHash: 'password123',
      };
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, hostUserDetails),
      );

      const roomDetails = {
        id: MOCK_ROOM_ID,
        name: 'Room To Delete',
        maxPlayers: 2,
        hostId: MOCK_HOST_ID,
        status: RoomStatus.WAITING,
      };
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, roomDetails),
      );

      const hostRoomPlayerDetails = {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_HOST_ID,
        status: RoomPlayerStatus.ACTIVE,
      };
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, hostRoomPlayerDetails),
      );

      mockCacheManager.del.mockResolvedValue(undefined);

      const result = await service.deleteRoom(MOCK_ROOM_ID, MOCK_HOST_ID);
      expect(result).toEqual({
        message: `Room with ID "${MOCK_ROOM_ID}" successfully deleted.`,
      });

      const roomInDb = await AppDataSource.manager.findOneBy(Room, {
        id: MOCK_ROOM_ID,
      });
      expect(roomInDb).toBeNull();
      const roomPlayersInDb = await AppDataSource.manager.findBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
      });
      expect(roomPlayersInDb.length).toBe(0);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith({
        id: MOCK_ROOM_ID,
        status: RoomStatus.FINISHED,
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`); // Use mockCacheManager
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Attempting to delete room ${MOCK_ROOM_ID} by host: ${MOCK_HOST_ID}`,
        'RoomManagementService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Room with ID "${MOCK_ROOM_ID}" successfully deleted by host: ${MOCK_HOST_ID}`,
        'RoomManagementService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Cache for room ${MOCK_ROOM_ID} invalidated due to deletion.`,
        'RoomManagementService',
      );
    });

    it('should throw NotFoundException if room could not be deleted (e.g. already deleted in transaction)', async () => {
      const roomId = MOCK_ROOM_ID;
      const hostId = MOCK_HOST_ID;

      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: hostId,
          username: 'del-test-user',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        // Corrected: Added await AppDataSource.manager.save
        Room,
        AppDataSource.manager.create(Room, {
          id: roomId, // Use local roomId for this test
          hostId: hostId,
          name: 'Test',
        }),
      );

      const mockTransaction = jest.spyOn(dataSource, 'transaction');
      mockTransaction.mockImplementationOnce(
        (async (runInTransaction: (entityManager: any) => Promise<any>) => {
          const mockEntityManager = {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: roomId, hostId: hostId }),
            delete: jest
              .fn()
              .mockResolvedValueOnce({ affected: 1 }) // For RoomPlayer delete
              .mockResolvedValueOnce({ affected: 0 }), // For Room delete (simulating not found/deleted)
          };
          return runInTransaction(mockEntityManager);
        }) as any, // Cast the entire async function expression to any
      );

      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${roomId}" could not be deleted or was already deleted.`, // Use local roomId
        ),
      );
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        `Room with ID "${roomId}" could not be deleted or was already deleted.`, // Use local roomId
        'RoomManagementService',
      );
      mockTransaction.mockRestore();
    });

    it('should throw NotFoundException if room not found for deletion', async () => {
      await expect(
        service.deleteRoom(MOCK_NON_EXISTENT_ROOM_ID, MOCK_HOST_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found`,
        ),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found for deletion.`,
        'RoomManagementService',
      );
    });

    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = MOCK_ROOM_ID;
      const unauthorizedHostId = MOCK_UNAUTHORIZED_HOST_ID;

      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'original-host',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, {
          id: roomId,
          hostId: MOCK_HOST_ID,
          name: 'Test',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: unauthorizedHostId,
          username: 'unauth-host',
          passwordHash: 'hash',
        }),
      );

      await expect(
        service.deleteRoom(roomId, unauthorizedHostId),
      ).rejects.toThrow(ForbiddenException);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService directly
        `Forbidden: Host ${unauthorizedHostId} attempted to delete room ${roomId} which they do not own.`,
        'RoomManagementService',
      );
    });
  });
});
