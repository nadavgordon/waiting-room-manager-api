import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomService } from '../src/waiting-room/waiting-room.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { RoomPlayer } from '../src/waiting-room/entities/room-player.entity';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { User } from '../src/user/entities/user.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { JoinRequestDecision } from '../src/waiting-room/dto/respond-to-join-request.dto';
import { LoggerService } from '../src/common/logger/logger.service';
import { Cache } from 'cache-manager';

/**
 * @file waiting-room.service.spec.ts
 * @description Unit tests for the `WaitingRoomService`.
 * These tests cover the core business logic for managing waiting rooms,
 * including room creation, listing, joining, leaving, updating, deleting,
 * responding to join requests, and starting games.
 * Mocks are extensively used for TypeORM repositories, Cache Manager,
 * WaitingRoomGateway, and LoggerService to isolate the service's logic.
 */
describe('WaitingRoomService', () => {
  let service: WaitingRoomService;
  let roomRepository: Repository<Room>;
  let roomPlayerRepository: Repository<RoomPlayer>;
  let userRepository: Repository<User>;
  let waitingRoomGateway: WaitingRoomGateway;
  let loggerService: LoggerService;
  let cacheManager: Cache;

  // Mock implementation for the RoomRepository.
  // Provides mock functions for common TypeORM repository methods.
  const mockRoomRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(null),
    // Mock createQueryBuilder for complex queries like findAllRooms.
    createQueryBuilder: jest.fn().mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getOne: jest.fn(),
    }),
    count: jest.fn(),
    update: jest.fn(),
  };

  // Mock implementation for the RoomPlayerRepository.
  const mockRoomPlayerRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  };

  // Mock implementation for the UserRepository.
  const mockUserRepository = {
    findOneBy: jest.fn(),
  };

  // Mock implementation for the WaitingRoomGateway.
  // Used to spy on WebSocket emission methods.
  const mockWaitingRoomGateway = {
    emitRoomUpdate: jest.fn(),
    emitRoomPlayersUpdate: jest.fn(),
  };

  // Mock implementation for the LoggerService.
  // Used to spy on logging calls.
  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  // Mock implementation for the CacheManager.
  // Used to spy on cache interaction methods.
  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  /**
   * Sets up the testing module and injects the service and its mocked dependencies before each test.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingRoomService,
        {
          provide: getRepositoryToken(Room),
          useValue: mockRoomRepository,
        },
        {
          provide: getRepositoryToken(RoomPlayer),
          useValue: mockRoomPlayerRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: WaitingRoomGateway,
          useValue: mockWaitingRoomGateway,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<WaitingRoomService>(WaitingRoomService);
    roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room));
    roomPlayerRepository = module.get<Repository<RoomPlayer>>(getRepositoryToken(RoomPlayer));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    waitingRoomGateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
    loggerService = module.get<LoggerService>(LoggerService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  /**
   * Clears all Jest mocks after each test to ensure test isolation.
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test case: Ensures the service instance is defined.
   */
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
      const createRoomDto = { name: 'Test Room', maxPlayers: 4, isPublic: true, approvalRequired: false };
      const hostId = 'host-uuid';
      const mockHost = { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User;
      const mockRoom = { id: 'room-uuid', ...createRoomDto, hostId: hostId, host: mockHost, status: RoomStatus.WAITING, roomPlayers: [], createdAt: new Date(), updatedAt: new Date() };

      mockUserRepository.findOneBy.mockResolvedValue(mockHost);
      mockRoomRepository.create.mockReturnValue(mockRoom);
      mockRoomRepository.save.mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});
      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom); // Mock internal call

      const result = await service.createRoom(createRoomDto, hostId);

      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: hostId });
      expect(mockRoomRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        ...createRoomDto,
      }));
      expect(mockRoomRepository.save).toHaveBeenCalledWith(mockRoom);
      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
        roomId: mockRoom.id,
        userId: hostId,
        status: RoomPlayerStatus.ACTIVE,
      });
      expect(mockRoomPlayerRepository.save).toHaveBeenCalled();
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to create room for host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Room created with ID: ${mockRoom.id} by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Host ${hostId} added as active player to room ${mockRoom.id}`, 'WaitingRoomService');
      expect(result).toEqual(mockRoom);
    });

    /**
     * Test case: Should throw NotFoundException if the host is not found.
     * Ensures that room creation fails if the provided host ID does not correspond to an existing user.
     */
    it('should throw NotFoundException if host not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null); // Simulate host not found
      const createRoomDto = { name: 'Test Room', maxPlayers: 4, isPublic: true, approvalRequired: false };
      const hostId = 'non-existent-host';

      await expect(service.createRoom(createRoomDto, hostId)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: hostId });
      expect(loggerService.error).toHaveBeenCalledWith(`Host with ID "${hostId}" not found during room creation.`, 'WaitingRoomService');
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
        { id: 'room1', name: 'Public Room 1', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'room2', name: 'Public Room 2', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host2', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      const total = 2;
      mockRoomRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms('anonymous', 1, 10); // 'anonymous' userId
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(mockRoomRepository.createQueryBuilder().where).toHaveBeenCalledWith('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      expect(mockRoomRepository.createQueryBuilder().skip).toHaveBeenCalledWith(0);
      expect(mockRoomRepository.createQueryBuilder().take).toHaveBeenCalledWith(10);
    });

    /**
     * Test case: Should return paginated public rooms and rooms where the user is host or an active player if userId is provided.
     * Verifies that authenticated users see public rooms, their hosted rooms, and rooms they are active in.
     */
    it('should return paginated public rooms and rooms where user is host or active player if userId is provided', async () => {
      const userId = 'user-id';
      const mockRooms = [
        { id: 'room1', name: 'Public Room 1', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'room2', name: 'Private Room Host', isPublic: false, approvalRequired: true, maxPlayers: 10, status: RoomStatus.WAITING, hostId: userId, createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      const total = 2;
      mockRoomRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms(userId, 1, 10);
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(mockRoomRepository.createQueryBuilder().where).toHaveBeenCalledWith('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      expect(mockRoomRepository.createQueryBuilder().orWhere).toHaveBeenCalledWith('room.hostId = :currentUserId', { currentUserId: userId });
      expect(mockRoomRepository.createQueryBuilder().orWhere).toHaveBeenCalledWith('roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus', {
        currentUserId: userId,
        activeStatus: RoomPlayerStatus.ACTIVE,
      });
      expect(mockRoomRepository.createQueryBuilder().skip).toHaveBeenCalledWith(0);
      expect(mockRoomRepository.createQueryBuilder().take).toHaveBeenCalledWith(10);
    });

    /**
     * Test case: Should handle different page and limit values for pagination.
     * Verifies that pagination parameters are correctly applied to the query.
     */
    it('should handle different page and limit values', async () => {
      const userId = 'user-id';
      const mockRooms = [
        { id: 'room3', name: 'Public Room 3', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host3', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      const total = 5;
      mockRoomRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms(userId, 2, 1); // Page 2, limit 1
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(mockRoomRepository.createQueryBuilder().skip).toHaveBeenCalledWith(1); // (page - 1) * limit = (2 - 1) * 1 = 1
      expect(mockRoomRepository.createQueryBuilder().take).toHaveBeenCalledWith(1); // limit = 1
    });
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
        id: 'room-uuid',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'], // Ensure relations are loaded
      });
      expect(loggerService.log).toHaveBeenCalledWith('Attempting to find room by ID: room-uuid', 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith('Room found with ID: room-uuid', 'WaitingRoomService');
    });

    /**
     * Test case: Should throw NotFoundException if the room is not found.
     * Ensures that an appropriate exception is thrown for non-existent room IDs.
     */
    it('should throw NotFoundException if room not found', async () => {
      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss
      mockRoomRepository.findOne.mockResolvedValue(null); // Simulate room not found in DB
      await expect(service.findRoomById('non-existent-room')).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith('Room with ID "non-existent-room" not found.', 'WaitingRoomService');
    });

    /**
     * Test case: Should return a room from cache if available.
     * Verifies that the service prioritizes fetching from cache if the data is present.
     */
    it('should return a room from cache if available', async () => {
      const mockRoom = {
        id: 'room-uuid',
        name: 'Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(mockRoom); // Simulate cache hit
      mockRoomRepository.findOne.mockResolvedValue(mockRoom); // Should not be called if cache hits

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith('room_room-uuid');
      expect(mockRoomRepository.findOne).not.toHaveBeenCalled(); // Verify cache hit, DB not queried
      expect(loggerService.log).toHaveBeenCalledWith('Room with ID: room-uuid found in cache.', 'WaitingRoomService');
    });

    /**
     * Test case: Should cache the room if not found in cache but found in DB.
     * Verifies that the service caches the room after fetching it from the database.
     */
    it('should cache the room if not found in cache', async () => {
      const mockRoom = {
        id: 'room-uuid',
        name: 'New Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss
      mockRoomRepository.findOne.mockResolvedValue(mockRoom); // Simulate DB hit
      mockCacheManager.set.mockResolvedValue(undefined); // Mock cache set operation

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith('room_room-uuid');
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith('room_room-uuid', mockRoom); // Verify caching
      expect(loggerService.log).toHaveBeenCalledWith('Room found with ID: room-uuid and cached.', 'WaitingRoomService');
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
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Old Name',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const updatedRoom = { ...existingRoom, ...updateRoomDto } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom); // Mock internal call
      mockRoomRepository.save.mockResolvedValue(updatedRoom);

      const result = await service.updateRoom(roomId, updateRoomDto, hostId);
      expect(result).toEqual(updatedRoom);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(updatedRoom);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(updatedRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to update room ${roomId} by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Room ${roomId} updated successfully by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to update.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw ForbiddenException if the host is not authorized.
     * Ensures that only the room host can update room details.
     */
    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = {
        id: roomId,
        hostId: 'original-host-uuid', // Different host
        name: 'Old Name',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom);

      await expect(service.updateRoom(roomId, updateRoomDto, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to update room ${roomId} which they do not own.`, 'WaitingRoomService');
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
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const existingRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom); // Simulate room found for deletion check
      mockRoomPlayerRepository.delete.mockResolvedValue({ affected: 1 }); // Simulate player deletion
      mockRoomRepository.delete.mockResolvedValue({ affected: 1 }); // Simulate room deletion

      const result = await service.deleteRoom(roomId, hostId);
      expect(result).toEqual({ message: `Room with ID "${roomId}" successfully deleted.` });
      expect(mockRoomPlayerRepository.delete).toHaveBeenCalledWith({ roomId: roomId }); // Verify player deletion
      expect(mockRoomRepository.delete).toHaveBeenCalledWith(roomId); // Verify room deletion
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith({ id: roomId, status: RoomStatus.FINISHED }); // Notify clients
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to delete room ${roomId} by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Room with ID "${roomId}" successfully deleted by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to deletion.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw NotFoundException if the room could not be deleted (affected 0 rows).
     * Handles cases where the delete operation doesn't affect any rows, implying the room was already gone.
     */
    it('should throw NotFoundException if room could not be deleted (affected 0)', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const existingRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      mockRoomPlayerRepository.delete.mockResolvedValue({ affected: 1 });
      mockRoomRepository.delete.mockResolvedValue({ affected: 0 }); // Simulate no rows affected by room delete

      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(NotFoundException);
      expect(loggerService.error).toHaveBeenCalledWith(`Room with ID "${roomId}" could not be deleted or was already deleted.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw NotFoundException if the room is not found for deletion.
     * Ensures that deletion fails for non-existent room IDs.
     */
    it('should throw NotFoundException if room not found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null); // Simulate room not found
      await expect(service.deleteRoom('non-existent-room', 'host-id')).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith('Room with ID "non-existent-room" not found for deletion.', 'WaitingRoomService');
    });
    
    /**
     * Test case: Should throw ForbiddenException if the host is not authorized to delete the room.
     * Ensures that only the room host can delete the room.
     */
    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const existingRoom = {
        id: roomId,
        hostId: 'original-host-uuid', // Different host
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`, 'WaitingRoomService');
    });
  });

  /**
   * Test suite for `joinRoom` method.
   */
  describe('joinRoom', () => {
    /**
     * Test case: Should allow a user to join a public room.
     * Verifies that a user can join a public room directly, becoming an active player.
     */
    it('should allow a user to join a public room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Active Player Room',
        isPublic: true, // Public room
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null); // No existing player entry
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No active players yet
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});

      const result = await service.joinRoom(roomId, userId);
      expect(result).toEqual(mockRoom);
      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
        roomId: roomId,
        userId: userId,
        status: RoomPlayerStatus.ACTIVE, // Should be active for public rooms
      });
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to join room ${roomId} by user: ${userId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} joined room ${roomId} as ACTIVE (public or no approval required).`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to join.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should set player status to PENDING for private rooms requiring approval.
     * Verifies that users joining private rooms with approval required are set to PENDING.
     */
    it('should set player status to PENDING for private rooms requiring approval', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Pending Request Room',
        isPublic: false, // Private room
        approvalRequired: true, // Approval required
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomPlayerRepository.count.mockResolvedValue(0);
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});

      await service.joinRoom(roomId, userId);
      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
        roomId: roomId,
        userId: userId,
        status: RoomPlayerStatus.PENDING, // Should be pending
      });
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} join request for room ${roomId} set to PENDING (private, approval required).`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the room is full.
     * Ensures that users cannot join a room that has reached its maximum player capacity.
     */
    it('should throw BadRequestException if room is full', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Full Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 1, // Max players is 1
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Simulate 1 active player, so room is full

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled(); // No new player entry should be created
      expect(loggerService.warn).toHaveBeenCalledWith(`Room ${roomId} is full. User ${userId} cannot join.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the player is already active in the room.
     * Prevents duplicate active entries for the same user in a room.
     */
    it('should throw BadRequestException if player is already active in room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'User Not Found Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.ACTIVE } as RoomPlayer; // Player already active

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} is already an active player in room ${roomId}.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if a join request is already pending.
     * Prevents multiple pending requests from the same user for the same room.
     */
    it('should throw BadRequestException if join request is already pending', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Room No Approval Required',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.PENDING } as RoomPlayer; // Pending request exists

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(`Join request already pending for user ${userId} in room ${roomId}.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw NotFoundException if the user is not found.
     * Ensures that joining fails if the provided user ID does not exist.
     */
    it('should throw NotFoundException if user not found', async () => {
      const roomId = 'room-uuid';
      const userId = 'non-existent-user';
      const mockRoom = {
        id: roomId,
        name: 'Pending Request Not Found Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
    
      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(null); // Simulate user not found
    
      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(NotFoundException);
      expect(loggerService.error).toHaveBeenCalledWith(`User with ID "${userId}" not found during join room operation.`, 'WaitingRoomService');
    });
    
    /**
     * Test case: Should remove an old room player entry if its status is not ACTIVE or PENDING.
     * This handles scenarios where a user might have previously left or been declined,
     * allowing them to re-join by removing the old entry and creating a new one.
     */
    it('should remove old room player entry if status is not ACTIVE or PENDING', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Room Full On Approval Test',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId, createdAt: new Date(), updatedAt: new Date() } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.LEFT } as RoomPlayer; // Simulate a previously left player
    
      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer); // Found old entry
      mockRoomPlayerRepository.remove.mockResolvedValue(existingPlayer); // Mock removal
      mockRoomPlayerRepository.count.mockResolvedValue(0);
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});
    
      await service.joinRoom(roomId, userId);
      expect(mockRoomPlayerRepository.remove).toHaveBeenCalledWith(existingPlayer); // Verify old entry removed
      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
        roomId: roomId,
        userId: userId,
        status: RoomPlayerStatus.ACTIVE, // New active entry created
      });
      expect(loggerService.log).toHaveBeenCalledWith(`Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`, 'WaitingRoomService');
    });
  });

  /**
   * Test suite for `approveOrDeclineJoinRequest` method.
   */
  describe('approveOrDeclineJoinRequest', () => {
    /**
     * Test case: Should approve a pending join request.
     * Verifies that a host can approve a pending request, changing the player's status to ACTIVE.
     */
    it('should approve a pending join request', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No active players yet
      mockRoomPlayerRepository.save.mockResolvedValue({ ...pendingRoomPlayer, status: RoomPlayerStatus.ACTIVE });

      const result = await service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId);
      expect(result).toEqual(mockRoom); // findRoomById is called at the end
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.ACTIVE); // Verify status update
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(pendingRoomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Host ${hostId} attempting to ${JoinRequestDecision.APPROVE} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Join request for user ${pendingUserId} in room ${roomId} APPROVED.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should decline a pending join request.
     * Verifies that a host can decline a pending request, changing the player's status to DECLINED.
     */
    it('should decline a pending join request', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...pendingRoomPlayer, status: RoomPlayerStatus.DECLINED });

      const result = await service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.DECLINE, hostId);
      expect(result).toEqual(mockRoom);
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.DECLINED); // Verify status update
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(pendingRoomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Host ${hostId} attempting to ${JoinRequestDecision.DECLINE} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Join request for user ${pendingUserId} in room ${roomId} DECLINED.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw ForbiddenException if the user is not the host.
     * Ensures that only the room host can approve or decline join requests.
     */
    it('should throw ForbiddenException if not host', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'unauthorized-host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: 'original-host-uuid', // Different host
        name: 'Test Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the room does not require approval.
     * Prevents hosts from trying to approve/decline requests for rooms that don't have this feature enabled.
     */
    it('should throw BadRequestException if room does not require approval', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false, // Approval not required
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw NotFoundException if the pending request is not found.
     * Ensures that only existing pending requests can be processed.
     */
    it('should throw NotFoundException if pending request not found', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'non-existent-pending-user';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null); // Simulate pending request not found

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Join request for user "${pendingUserId}" in room ${roomId} not found or already processed.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the room is full on approval.
     * Prevents approving a request if the room would become over capacity.
     */
    it('should throw BadRequestException if room is full on approval', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Full Room Approval Test',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 1, // Room is full
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Simulate 1 active player, so room is full

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.PENDING); // Status should not change
      expect(loggerService.warn).toHaveBeenCalledWith(`Cannot approve join request for user ${pendingUserId} in room ${roomId}: Room is full.`, 'WaitingRoomService');
    });
  });

  /**
   * Test suite for `leaveRoom` method.
   */
  describe('leaveRoom', () => {
    /**
     * Test case: Should allow an active player to leave a room.
     * Verifies that an active player's status is updated to LEFT upon leaving.
     */
    it('should allow an active player to leave a room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host', createdAt: new Date(), updatedAt: new Date() } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.ACTIVE } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...roomPlayer, status: RoomPlayerStatus.LEFT });

      const result = await service.leaveRoom(roomId, userId);
      expect(result).toEqual(mockRoom);
      expect(roomPlayer.status).toBe(RoomPlayerStatus.LEFT); // Verify status update
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(roomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} attempting to leave room: ${roomId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to leave.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should allow a pending player to cancel their join request.
     * Verifies that a player with a pending request can cancel it, changing their status to LEFT.
     */
    it('should allow a pending player to cancel their request', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host', createdAt: new Date(), updatedAt: new Date() } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...roomPlayer, status: RoomPlayerStatus.LEFT });

      await service.leaveRoom(roomId, userId);
      expect(roomPlayer.status).toBe(RoomPlayerStatus.LEFT); // Verify status update
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(roomPlayer);
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the host tries to leave using the player leave endpoint.
     * Hosts should delete the room, not leave it as a player.
     */
    it('should throw BadRequestException if host tries to leave', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, createdAt: new Date(), updatedAt: new Date() } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.leaveRoom(roomId, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Host ${hostId} attempted to leave room ${roomId} using player leave endpoint.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the user is not associated with the room.
     * Ensures that only users who are part of a room can attempt to leave it.
     */
    it('should throw BadRequestException if user is not associated with room', async () => {
      const roomId = 'room-uuid';
      const userId = 'non-associated-user';
      const mockRoom = { id: roomId, hostId: 'host-id', createdAt: new Date(), updatedAt: new Date() } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null); // Simulate no association found

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} is not associated with room ${roomId}.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should throw BadRequestException if the user has already left or declined.
     * Prevents redundant leave attempts for users who are no longer active or pending in the room.
     */
    it('should throw BadRequestException if user has already left or declined', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host', createdAt: new Date(), updatedAt: new Date() } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.LEFT } as RoomPlayer; // Already left

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} has already left or declined to join room ${roomId}.`, 'WaitingRoomService');
    });
  });

  /**
   * Test suite for `startGame` method.
   */
  describe('startGame', () => {
    /**
     * Test case: Should start the game if the host is authorized and the room is in WAITING status.
     * Verifies that the room status changes to IN_PROGRESS and pending requests are declined.
     */
    it('should start the game if host is authorized and room is waiting', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING, // Room is waiting
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // At least one player
      mockRoomRepository.save.mockResolvedValue({ ...mockRoom, status: RoomStatus.IN_PROGRESS });
      mockRoomPlayerRepository.update.mockResolvedValue({}); // Mock update for pending players

      const result = await service.startGame(roomId, hostId);
      expect(result.status).toBe(RoomStatus.IN_PROGRESS); // Verify room status
      expect(mockRoomRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: RoomStatus.IN_PROGRESS }));
      expect(mockRoomPlayerRepository.update).toHaveBeenCalledWith(
        { roomId, status: RoomPlayerStatus.PENDING },
        { status: RoomPlayerStatus.DECLINED }, // Pending players should be declined
      );
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: RoomStatus.IN_PROGRESS }));
    });

    /**
     * Test case: Should throw ForbiddenException if the user is not the host.
     * Ensures that only the room host can start the game.
     */
    it('should throw ForbiddenException if not host', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: 'original-host-uuid', // Different host
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(ForbiddenException);
    });

    /**
     * Test case: Should throw BadRequestException if the room is not in WAITING status.
     * Ensures that games can only be started from the WAITING state.
     */
    it('should throw BadRequestException if room is not in WAITING status', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.IN_PROGRESS, // Not WAITING
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
    });

    /**
     * Test case: Should throw BadRequestException if there are no active players in the room.
     * Prevents starting a game in an empty room.
     */
    it('should throw BadRequestException if no players in room', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No players

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Cannot start game in room ${roomId}: No active players.`, 'WaitingRoomService');
    });

    /**
     * Test case: Should decline all pending join requests when the game starts.
     * Ensures that any outstanding join requests are automatically declined once the game begins.
     */
    it('should decline all pending join requests when game starts', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser', createdAt: new Date(), updatedAt: new Date() } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // At least one active player
      mockRoomRepository.save.mockResolvedValue({ ...mockRoom, status: RoomStatus.IN_PROGRESS });
      mockRoomPlayerRepository.update.mockResolvedValue({ affected: 1 }); // Simulate one pending request declined

      await service.startGame(roomId, hostId);
      expect(mockRoomPlayerRepository.update).toHaveBeenCalledWith(
        { roomId, status: RoomPlayerStatus.PENDING },
        { status: RoomPlayerStatus.DECLINED },
      );
      expect(loggerService.log).toHaveBeenCalledWith(`All pending join requests for room ${roomId} declined.`, 'WaitingRoomService');
    });
  });
});