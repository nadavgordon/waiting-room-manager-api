import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
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
import { JoinRequestDecision } from '../src/waiting-room/dto/respond-to-join-request.dto';
import { LoggerService } from '../src/common/logger/logger.service';
import { Cache } from 'cache-manager';
import { AppDataSource } from '../src/db/data-source';
import { RoomPlayerService } from '../src/waiting-room/room-player.service'; // New service
import { RoomQueryService } from '../src/waiting-room/room-query.service'; // Dependency

// Define valid UUID constants for testing
const MOCK_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MOCK_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const MOCK_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';
const MOCK_PENDING_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14';
const MOCK_NON_EXISTENT_ROOM_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16';
const MOCK_UNAUTHORIZED_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17';
const MOCK_ANOTHER_HOST_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18'; // For leaveRoom host check
const MOCK_NON_EXISTENT_USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19';
const MOCK_NON_EXISTENT_PENDING_USER_ID =
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20';

/**
 * @file room-player.service.spec.ts
 * @description Unit tests for the `RoomPlayerService`.
 * These tests cover the logic for players joining, leaving rooms,
 * and hosts responding to join requests.
 * Mocks are used for TypeORM repositories, Cache Manager, LoggerService,
 * WaitingRoomGateway, and RoomQueryService.
 */
describe('RoomPlayerService', () => {
  let service: RoomPlayerService;
  let waitingRoomGateway: WaitingRoomGateway;
  let loggerService: LoggerService;
  let cacheManager: Cache;
  // Removed roomPlayerRepository, userRepository, roomQueryService, dataSource as they are shadowed or unused at this scope

  const mockRoomPlayerRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
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
    del: jest.fn(),
  };

  const mockRoomQueryService = {
    // This is the actual mock object
    findRoomById: jest.fn(),
  };

  const mockRoomRepository = {
    // This is the actual mock object
    findOne: jest.fn(),
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
        RoomPlayerService,
        {
          provide: getRepositoryToken(RoomPlayer),
          useValue: mockRoomPlayerRepository,
        },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Room), useValue: mockRoomRepository }, // For AppDataSource.manager if it uses it
        { provide: WaitingRoomGateway, useValue: mockWaitingRoomGateway },
        { provide: LoggerService, useValue: mockLoggerService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: RoomQueryService, useValue: mockRoomQueryService },
        { provide: DataSource, useValue: AppDataSource },
      ],
    }).compile();

    service = module.get<RoomPlayerService>(RoomPlayerService);
    // roomPlayerRepository = module.get<Repository<RoomPlayer>>(getRepositoryToken(RoomPlayer)); // Not assigned
    // userRepository = module.get<Repository<User>>(getRepositoryToken(User)); // Not assigned
    waitingRoomGateway = module.get<WaitingRoomGateway>(WaitingRoomGateway); // Get actual mock
    loggerService = module.get<LoggerService>(LoggerService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
    // roomQueryService = module.get<RoomQueryService>(RoomQueryService);
    // dataSource = module.get<DataSource>(DataSource); // Instance from module.get is used if needed
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
   * Test suite for `joinRoom` method.
   */
  describe('joinRoom', () => {
    let mockRoomData: Room;
    let mockUserData: User;

    beforeEach(() => {
      // Reset and define common mock data for each test in this suite
      mockRoomData = {
        id: MOCK_ROOM_ID,
        name: 'Test Join Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_HOST_ID,
        host: { id: MOCK_HOST_ID, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Room;

      mockUserData = {
        email: null,
        id: MOCK_USER_ID,
        username: 'joinuser',
        passwordHash: 'hashedpassword',
        createdAt: new Date(),
        updatedAt: new Date(),
        rooms: [],
        roomPlayers: [],
        hostedRooms: [],
        sentMessages: [],
        receivedMessages: [],
        refreshTokens: [],
        refreshTokenHash: null, // Added
        refreshTokenExpiresAt: null, // Added
      } as User;

      // Mock the roomQueryService.findRoomById for the end of the transaction
      // This is called to get the fully populated room for the event and return value
      mockRoomQueryService.findRoomById.mockImplementation((roomId) => {
        // Removed async
        // Return a slightly modified version of mockRoomData to simulate it being "refetched"
        // In a real scenario, this would include the newly added player.
        // For the mock, we'll assume the calling test will verify the player creation separately.
        return Promise.resolve({
          // Ensure it returns a Promise
          ...mockRoomData,
          id: roomId,
          roomPlayers: [
            /* potentially include new player if easy to mock */
          ],
        } as Room);
      });
      mockCacheManager.del.mockResolvedValue(undefined);
    });

    /**
     * Test case: Should allow a user to join a public room.
     */
    it('should allow a user to join a public room (no approval needed)', async () => {
      // Seed the host and user, but only if DB connection is initialized
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
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, mockUserData),
          );
          // Seed the room
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, mockRoomData),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      // Transactional mocks:
      // The service uses dataSource.transaction(async (manager) => { ... })
      // manager.findOne for Room, manager.findOneBy for User, manager.findOne for existing RoomPlayer,
      // manager.count for active players, manager.create for RoomPlayer, manager.save for RoomPlayer.

      const result = await service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID);

      expect(result.id).toEqual(MOCK_ROOM_ID); // findRoomById is called at the end

      let roomPlayerInDb = null;
      if (AppDataSource.isInitialized) {
        roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
        });
      }
      expect(roomPlayerInDb).toBeDefined();
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.ACTIVE);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: MOCK_ROOM_ID }),
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`); // Use mockCacheManager
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Attempting to join room ${MOCK_ROOM_ID} by user: ${MOCK_USER_ID}`,
        'RoomPlayerService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `User ${MOCK_USER_ID} joined room ${MOCK_ROOM_ID} as ACTIVE (no approval required).`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should set player status to PENDING for rooms requiring approval.
     */
    it('should set player status to PENDING for rooms requiring approval', async () => {
      const roomRequiringApproval = {
        ...mockRoomData,
        approvalRequired: true,
        isPublic: false,
      };
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
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, mockUserData),
          );
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, roomRequiringApproval),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      await service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID);

      let roomPlayerInDb = null;
      if (AppDataSource.isInitialized) {
        roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
        });
      }
      expect(roomPlayerInDb).toBeDefined();
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.PENDING);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `User ${MOCK_USER_ID} join request for room ${MOCK_ROOM_ID} set to PENDING (approval required).`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the room is full.
     */
    it('should throw BadRequestException if room is full', async () => {
      const fullRoom = { ...mockRoomData, maxPlayers: 2 };
      // Seed host, user, room, and existing active players to make it full
      // Using maxPlayers: 2 to comply with database constraint CHK_rooms_maxPlayers_min
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
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, mockUserData),
          );
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, {
              id: MOCK_ANOTHER_HOST_ID,
              username: 'anotherplayer',
              passwordHash: 'hash',
            }),
          ); // Another player
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, fullRoom),
          );
          // Add the host as a player
          await AppDataSource.manager.save(
            RoomPlayer,
            AppDataSource.manager.create(RoomPlayer, {
              roomId: MOCK_ROOM_ID,
              userId: MOCK_HOST_ID,
              status: RoomPlayerStatus.ACTIVE,
            }),
          );
          
          // Add second player to fill the room (maxPlayers = 2)
          await AppDataSource.manager.save(
            RoomPlayer,
            AppDataSource.manager.create(RoomPlayer, {
              roomId: MOCK_ROOM_ID,
              userId: MOCK_ANOTHER_HOST_ID,
              status: RoomPlayerStatus.ACTIVE,
            }),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      await expect(
        service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(new BadRequestException('Room is full.'));
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Room ${MOCK_ROOM_ID} is full. User ${MOCK_USER_ID} cannot join.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the player is already active in the room.
     */
    it('should throw BadRequestException if player is already active in room', async () => {
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
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, mockUserData),
          );
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, mockRoomData),
          );
          // Seed the user as already active
          await AppDataSource.manager.save(
            RoomPlayer,
            AppDataSource.manager.create(RoomPlayer, {
              roomId: MOCK_ROOM_ID,
              userId: MOCK_USER_ID,
              status: RoomPlayerStatus.ACTIVE,
            }),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      await expect(
        service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new BadRequestException('Player is already in this room.'),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `User ${MOCK_USER_ID} is already an active player in room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if a join request is already pending.
     */
    it('should throw BadRequestException if join request is already pending', async () => {
      const roomRequiringApproval = { ...mockRoomData, approvalRequired: true };
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
          await AppDataSource.manager.save(
            User,
            AppDataSource.manager.create(User, mockUserData),
          );
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, roomRequiringApproval),
          );
          // Seed the user as already pending
          await AppDataSource.manager.save(
            RoomPlayer,
            AppDataSource.manager.create(RoomPlayer, {
              roomId: MOCK_ROOM_ID,
              userId: MOCK_USER_ID,
              status: RoomPlayerStatus.PENDING,
            }),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      }

      await expect(
        service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new BadRequestException('Join request already pending for this room.'),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Join request already pending for user ${MOCK_USER_ID} in room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw NotFoundException if the user is not found.
     */
    it('should throw NotFoundException if user not found', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomData),
      );
      // MOCK_NON_EXISTENT_USER_ID is not seeded

      await expect(
        service.joinRoom(MOCK_ROOM_ID, MOCK_NON_EXISTENT_USER_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `User with ID "${MOCK_NON_EXISTENT_USER_ID}" not found.`,
        ),
      );
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        // Use mockLoggerService
        `User with ID "${MOCK_NON_EXISTENT_USER_ID}" not found during join room operation.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw NotFoundException if the room is not found.
     */
    it('should throw NotFoundException if room not found', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, mockUserData),
      );
      // MOCK_NON_EXISTENT_ROOM_ID is not seeded

      await expect(
        service.joinRoom(MOCK_NON_EXISTENT_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found`,
        ),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should remove an old room player entry if its status is not ACTIVE or PENDING.
     */
    it('should remove old room player entry (e.g. LEFT) and allow re-join', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, mockUserData),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomData),
      );
      // Seed the user as previously LEFT
      const oldPlayerEntry = await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
          status: RoomPlayerStatus.LEFT,
        }),
      );

      await service.joinRoom(MOCK_ROOM_ID, MOCK_USER_ID);

      const oldEntryInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        id: oldPlayerEntry.id,
      });
      expect(oldEntryInDb).toBeNull(); // Old entry should be removed

      const newPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_USER_ID,
        status: RoomPlayerStatus.ACTIVE,
      });
      expect(newPlayerInDb).toBeDefined(); // New entry should be active

      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Removing old room player entry for user ${MOCK_USER_ID} in room ${MOCK_ROOM_ID} (status: ${RoomPlayerStatus.LEFT}).`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if host tries to join their own room as a player.
     */
    it('should throw BadRequestException if host tries to join their own room', async () => {
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
          await AppDataSource.manager.save(
            Room,
            AppDataSource.manager.create(Room, mockRoomData),
          );
        } catch (error) {
          console.error('Error seeding test data:', error);
        }
      } // mockRoomData has MOCK_HOST_ID as hostId

      await expect(
        service.joinRoom(MOCK_ROOM_ID, MOCK_HOST_ID),
      ).rejects.toThrow(
        new BadRequestException(
          'Host is already part of the room and cannot join as a player.',
        ),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Host ${MOCK_HOST_ID} attempted to join room ${MOCK_ROOM_ID} as a player.`,
        'RoomPlayerService',
      );
    });
  });

  /**
   * Test suite for `approveOrDeclineJoinRequest` method.
   */
  describe('approveOrDeclineJoinRequest', () => {
    let mockRoomDataForApproval: Room;

    beforeEach(() => {
      mockRoomDataForApproval = {
        id: MOCK_ROOM_ID,
        name: 'Approval Test Room',
        isPublic: false,
        approvalRequired: true, // Crucial for these tests
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_HOST_ID,
        host: { id: MOCK_HOST_ID, username: 'hostuser' } as User,
        roomPlayers: [], // Will be populated by mocks/seeding as needed
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Room;

      // Mock the roomQueryService.findRoomById for the end of the transaction
      mockRoomQueryService.findRoomById.mockImplementation((roomId) => {
        // Removed async
        // This would ideally return the room with the player's status updated
        return Promise.resolve({
          ...mockRoomDataForApproval,
          id: roomId,
        } as Room); // Ensure Promise
      });
      mockCacheManager.del.mockResolvedValue(undefined);
    });

    /**
     * Test case: Should approve a pending join request.
     */
    it('should approve a pending join request', async () => {
      // Seed host, pending user, and room
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForApproval),
      );
      // Seed the pending player
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_PENDING_USER_ID,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      const result = await service.approveOrDeclineJoinRequest(
        MOCK_ROOM_ID,
        MOCK_PENDING_USER_ID,
        JoinRequestDecision.APPROVE,
        MOCK_HOST_ID,
      );

      expect(result.id).toEqual(MOCK_ROOM_ID);
      const roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_PENDING_USER_ID,
      });
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.ACTIVE);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: MOCK_ROOM_ID }),
      );
      expect(mockCacheManager.del).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`); // Use mockCacheManager
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Host ${MOCK_HOST_ID} attempting to ${JoinRequestDecision.APPROVE} join request for user ${MOCK_PENDING_USER_ID} in room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Join request for user ${MOCK_PENDING_USER_ID} in room ${MOCK_ROOM_ID} APPROVED.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should decline a pending join request.
     */
    it('should decline a pending join request', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForApproval),
      );
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_PENDING_USER_ID,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      await service.approveOrDeclineJoinRequest(
        MOCK_ROOM_ID,
        MOCK_PENDING_USER_ID,
        JoinRequestDecision.DECLINE,
        MOCK_HOST_ID,
      );

      const roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_PENDING_USER_ID,
      });
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.DECLINED);
      expect(mockLoggerService.log).toHaveBeenCalledWith(
        // Use mockLoggerService
        `Join request for user ${MOCK_PENDING_USER_ID} in room ${MOCK_ROOM_ID} DECLINED.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw ForbiddenException if the user is not the host.
     */
    it('should throw ForbiddenException if not host', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_UNAUTHORIZED_HOST_ID,
          username: 'unauthHost',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForApproval),
      ); // hostId is MOCK_HOST_ID
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_PENDING_USER_ID,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      await expect(
        service.approveOrDeclineJoinRequest(
          MOCK_ROOM_ID,
          MOCK_PENDING_USER_ID,
          JoinRequestDecision.APPROVE,
          MOCK_UNAUTHORIZED_HOST_ID, // Unauthorized host attempts
        ),
      ).rejects.toThrow(
        new ForbiddenException(
          'Only the room host can approve or decline join requests.',
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Forbidden: Host ${MOCK_UNAUTHORIZED_HOST_ID} attempted to approve/decline request in room ${MOCK_ROOM_ID} which they do not own.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the room does not require approval.
     */
    it('should throw BadRequestException if room does not require approval', async () => {
      const roomNoApprovalNeeded = {
        ...mockRoomDataForApproval,
        approvalRequired: false,
      };
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, roomNoApprovalNeeded),
      );
      // No pending player needed as the check for approvalRequired comes first

      await expect(
        service.approveOrDeclineJoinRequest(
          MOCK_ROOM_ID,
          MOCK_PENDING_USER_ID,
          JoinRequestDecision.APPROVE,
          MOCK_HOST_ID,
        ),
      ).rejects.toThrow(
        new BadRequestException(
          'This room does not require approval for join requests.',
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Room ${MOCK_ROOM_ID} does not require approval, but host ${MOCK_HOST_ID} attempted to approve/decline.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw NotFoundException if the pending request is not found.
     */
    it('should throw NotFoundException if pending request not found', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      // MOCK_NON_EXISTENT_PENDING_USER_ID is not seeded as a player in this room
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForApproval),
      );

      await expect(
        service.approveOrDeclineJoinRequest(
          MOCK_ROOM_ID,
          MOCK_NON_EXISTENT_PENDING_USER_ID,
          JoinRequestDecision.APPROVE,
          MOCK_HOST_ID,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `Join request for user "${MOCK_NON_EXISTENT_PENDING_USER_ID}" not found or already processed.`,
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Join request for user "${MOCK_NON_EXISTENT_PENDING_USER_ID}" in room ${MOCK_ROOM_ID} not found or already processed.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the room is full on approval.
     */
    it('should throw BadRequestException if room is full on approval', async () => {
      // Using maxPlayers: 2 to comply with database constraint CHK_rooms_maxPlayers_min
      const fullRoomOnApproval = { ...mockRoomDataForApproval, maxPlayers: 2 };
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_ANOTHER_HOST_ID,
          username: 'activePlayer',
          passwordHash: 'hash',
        }),
      ); // Existing active player
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, fullRoomOnApproval),
      );
      // Add the host as a player
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_HOST_ID,
          status: RoomPlayerStatus.ACTIVE,
        }),
      );
      
      // Add second player to fill the room (maxPlayers = 2)
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_ANOTHER_HOST_ID,
          status: RoomPlayerStatus.ACTIVE,
        }),
      ); // Makes room full
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_PENDING_USER_ID,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      await expect(
        service.approveOrDeclineJoinRequest(
          MOCK_ROOM_ID,
          MOCK_PENDING_USER_ID,
          JoinRequestDecision.APPROVE,
          MOCK_HOST_ID,
        ),
      ).rejects.toThrow(
        new BadRequestException('Cannot approve join request: Room is full.'),
      );

      const pendingPlayerInDb = await AppDataSource.manager.findOneBy(
        RoomPlayer,
        { roomId: MOCK_ROOM_ID, userId: MOCK_PENDING_USER_ID },
      );
      expect(pendingPlayerInDb?.status).toBe(RoomPlayerStatus.PENDING); // Status should not change
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Cannot approve join request for user ${MOCK_PENDING_USER_ID} in room ${MOCK_ROOM_ID}: Room is full.`,
        'RoomPlayerService',
      );
    });
    /**
     * Test case: Should throw NotFoundException if room not found.
     */
    it('should throw NotFoundException if room not found', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_HOST_ID,
          username: 'hostuser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_PENDING_USER_ID,
          username: 'pendinguser',
          passwordHash: 'hash',
        }),
      );
      // MOCK_NON_EXISTENT_ROOM_ID is not seeded

      await expect(
        service.approveOrDeclineJoinRequest(
          MOCK_NON_EXISTENT_ROOM_ID,
          MOCK_PENDING_USER_ID,
          JoinRequestDecision.APPROVE,
          MOCK_HOST_ID,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found`,
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found.`,
        'RoomPlayerService',
      );
    });
  });

  /**
   * Test suite for `leaveRoom` method.
   */
  describe('leaveRoom', () => {
    let mockRoomDataForLeave: Room;

    beforeEach(() => {
      mockRoomDataForLeave = {
        id: MOCK_ROOM_ID,
        name: 'Leave Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: MOCK_ANOTHER_HOST_ID, // A host different from the user leaving
        host: { id: MOCK_ANOTHER_HOST_ID, username: 'anotherHost' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      } as Room;

      mockRoomQueryService.findRoomById.mockImplementation((roomId) => {
        return Promise.resolve({ ...mockRoomDataForLeave, id: roomId } as Room);
      });
      mockCacheManager.del.mockResolvedValue(undefined);
    });

    /**
     * Test case: Should allow an active player to leave a room.
     */
    it('should allow an active player to leave a room', async () => {
      // Seed host, user who will leave, and room
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_ANOTHER_HOST_ID,
          username: 'anotherHost',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_USER_ID,
          username: 'leaverUser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForLeave),
      );
      // Seed the player as active
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
          status: RoomPlayerStatus.ACTIVE,
        }),
      );

      const result = await service.leaveRoom(MOCK_ROOM_ID, MOCK_USER_ID);

      expect(result.id).toEqual(MOCK_ROOM_ID);
      const roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_USER_ID,
      });
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.LEFT);

      expect(mockWaitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ id: MOCK_ROOM_ID }),
      );
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${MOCK_ROOM_ID}`);
      expect(loggerService.log).toHaveBeenCalledWith(
        `User ${MOCK_USER_ID} attempting to leave room: ${MOCK_ROOM_ID}`,
        'RoomPlayerService',
      );
      expect(loggerService.log).toHaveBeenCalledWith(
        `User ${MOCK_USER_ID} successfully left room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should allow a pending player to cancel their join request (effectively leaving).
     */
    it('should allow a pending player to cancel their request (leave)', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_ANOTHER_HOST_ID,
          username: 'anotherHost',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_USER_ID,
          username: 'pendingLeaver',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForLeave),
      );
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
          status: RoomPlayerStatus.PENDING,
        }),
      );

      await service.leaveRoom(MOCK_ROOM_ID, MOCK_USER_ID);

      const roomPlayerInDb = await AppDataSource.manager.findOneBy(RoomPlayer, {
        roomId: MOCK_ROOM_ID,
        userId: MOCK_USER_ID,
      });
      expect(roomPlayerInDb?.status).toBe(RoomPlayerStatus.LEFT);
    });

    /**
     * Test case: Should throw BadRequestException if the host tries to leave using the player leave endpoint.
     */
    it('should throw BadRequestException if host tries to leave', async () => {
      // Ensure a clean state for MOCK_USER_ID and MOCK_ROOM_ID for this specific test
      try {
        await AppDataSource.manager.delete(RoomPlayer, {
          userId: MOCK_USER_ID,
        });
        await AppDataSource.manager.delete(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
        });
        await AppDataSource.manager.delete(Room, { id: MOCK_ROOM_ID });
        await AppDataSource.manager.delete(Room, { hostId: MOCK_USER_ID });
        await AppDataSource.manager.delete(User, { id: MOCK_USER_ID });
      } catch (e) {
        console.error('Error during pre-test cleanup for host leave test:', e);
      }

      const roomHostedByUser = {
        ...mockRoomDataForLeave, // Contains a MOCK_ROOM_ID
        id: MOCK_ROOM_ID, // Explicitly set MOCK_ROOM_ID
        hostId: MOCK_USER_ID, // User is the host
      };
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_USER_ID,
          username: 'hostLeaver',
          passwordHash: 'hash',
        }),
      );
      // Ensure user is saved before creating room that depends on it
      const savedUser = await AppDataSource.manager.findOneBy(User, {
        id: MOCK_USER_ID,
      });
      if (!savedUser) {
        // This console.log might help see if the user save is the issue
        console.error(
          `CRITICAL: User ${MOCK_USER_ID} was NOT found after attempting to save.`,
        );
        throw new Error(`Test setup failed: User ${MOCK_USER_ID} not saved.`);
      }

      // Create the room object explicitly to avoid any spread issues
      const roomToSave = AppDataSource.manager.create(Room, {
        id: MOCK_ROOM_ID, // from mockRoomDataForLeave via spread, or explicitly
        name: roomHostedByUser.name, // from mockRoomDataForLeave via spread
        isPublic: roomHostedByUser.isPublic, // from mockRoomDataForLeave via spread
        approvalRequired: roomHostedByUser.approvalRequired, // from mockRoomDataForLeave via spread
        maxPlayers: roomHostedByUser.maxPlayers, // from mockRoomDataForLeave via spread
        status: roomHostedByUser.status, // from mockRoomDataForLeave via spread
        hostId: MOCK_USER_ID, // Explicitly MOCK_USER_ID
        // host: savedUser, // Optionally link the host object directly
        // roomPlayers: [], // Default or from spread
        // createdAt, updatedAt, version will be set by TypeORM or defaults
      });

      await AppDataSource.manager.save(
        Room,
        roomToSave, // Use the explicitly created object
      );
      // Host is implicitly an active player, but the check is on room.hostId === userId

      await expect(
        service.leaveRoom(MOCK_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new BadRequestException(
          'Host cannot leave the room using this endpoint. Hosts can delete their rooms.',
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Host ${MOCK_USER_ID} attempted to leave room ${MOCK_ROOM_ID} using player leave endpoint.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the user is not associated with the room.
     */
    it('should throw BadRequestException if user is not associated with room', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_ANOTHER_HOST_ID,
          username: 'anotherHost',
          passwordHash: 'hash',
        }),
      );
      // MOCK_NON_EXISTENT_USER_ID is not seeded as a player in this room
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForLeave),
      );

      await expect(
        service.leaveRoom(MOCK_ROOM_ID, MOCK_NON_EXISTENT_USER_ID),
      ).rejects.toThrow(
        new BadRequestException('User is not associated with this room.'),
      );
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        // Use mockLoggerService
        `User ${MOCK_NON_EXISTENT_USER_ID} is not associated with room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
    });

    /**
     * Test case: Should throw BadRequestException if the user has already left or declined.
     */
    it('should throw BadRequestException if user has already left or declined', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_ANOTHER_HOST_ID,
          username: 'anotherHost',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_USER_ID,
          username: 'alreadyLeftUser',
          passwordHash: 'hash',
        }),
      );
      await AppDataSource.manager.save(
        Room,
        AppDataSource.manager.create(Room, mockRoomDataForLeave),
      );
      // Seed player as already LEFT
      await AppDataSource.manager.save(
        RoomPlayer,
        AppDataSource.manager.create(RoomPlayer, {
          roomId: MOCK_ROOM_ID,
          userId: MOCK_USER_ID,
          status: RoomPlayerStatus.LEFT,
        }),
      );

      await expect(
        service.leaveRoom(MOCK_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new BadRequestException(
          'User has already left or declined to join this room.',
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `User ${MOCK_USER_ID} has already left or declined to join room ${MOCK_ROOM_ID}.`,
        'RoomPlayerService',
      );
    });
    /**
     * Test case: Should throw NotFoundException if room not found.
     */
    it('should throw NotFoundException if room not found', async () => {
      await AppDataSource.manager.save(
        User,
        AppDataSource.manager.create(User, {
          id: MOCK_USER_ID,
          username: 'leaverUser',
          passwordHash: 'hash',
        }),
      );
      // MOCK_NON_EXISTENT_ROOM_ID is not seeded

      await expect(
        service.leaveRoom(MOCK_NON_EXISTENT_ROOM_ID, MOCK_USER_ID),
      ).rejects.toThrow(
        new NotFoundException(
          `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found`,
        ),
      );
      expect(loggerService.warn).toHaveBeenCalledWith(
        `Room with ID "${MOCK_NON_EXISTENT_ROOM_ID}" not found.`,
        'RoomPlayerService',
      );
    });
  });
});
