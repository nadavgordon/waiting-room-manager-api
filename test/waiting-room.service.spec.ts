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

describe('WaitingRoomService', () => {
  let service: WaitingRoomService;
  let roomRepository: Repository<Room>;
  let roomPlayerRepository: Repository<RoomPlayer>;
  let userRepository: Repository<User>;
  let waitingRoomGateway: WaitingRoomGateway;
  let loggerService: LoggerService;
  let cacheManager: Cache;

  const mockRoomRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(null),
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

  const mockUserRepository = {
    findOneBy: jest.fn(),
  };

  const mockWaitingRoomGateway = {
    emitRoomUpdate: jest.fn(),
    emitRoomPlayersUpdate: jest.fn(),
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

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRoom', () => {
    it('should successfully create a room and add host as active player', async () => {
      const createRoomDto = { name: 'Test Room', maxPlayers: 4, isPublic: true, approvalRequired: false };
      const hostId = 'host-uuid';
      const mockHost = { id: hostId, username: 'hostuser' } as User;
      const mockRoom = { id: 'room-uuid', ...createRoomDto, hostId: hostId, host: mockHost, status: RoomStatus.WAITING, roomPlayers: [], createdAt: new Date(), updatedAt: new Date() };

      mockUserRepository.findOneBy.mockResolvedValue(mockHost);
      mockRoomRepository.create.mockReturnValue(mockRoom);
      mockRoomRepository.save.mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});
      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

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

    it('should throw NotFoundException if host not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      const createRoomDto = { name: 'Test Room', maxPlayers: 4, isPublic: true, approvalRequired: false };
      const hostId = 'non-existent-host';

      await expect(service.createRoom(createRoomDto, hostId)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: hostId });
      expect(loggerService.error).toHaveBeenCalledWith(`Host with ID "${hostId}" not found during room creation.`, 'WaitingRoomService');
    });
  });

  describe('findAllRooms', () => {
    it('should return paginated public rooms if no userId is provided', async () => {
      const mockRooms = [
        { id: 'room1', name: 'Public Room 1', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'room2', name: 'Public Room 2', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host2', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      const total = 2;
      mockRoomRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms('anonymous', 1, 10);
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(mockRoomRepository.createQueryBuilder().where).toHaveBeenCalledWith('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      expect(mockRoomRepository.createQueryBuilder().skip).toHaveBeenCalledWith(0);
      expect(mockRoomRepository.createQueryBuilder().take).toHaveBeenCalledWith(10);
    });

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

    it('should handle different page and limit values', async () => {
      const userId = 'user-id';
      const mockRooms = [
        { id: 'room3', name: 'Public Room 3', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host3', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      const total = 5;
      mockRoomRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([mockRooms, total]);

      const result = await service.findAllRooms(userId, 2, 1);
      expect(result.rooms).toEqual(mockRooms);
      expect(result.total).toEqual(total);
      expect(mockRoomRepository.createQueryBuilder().skip).toHaveBeenCalledWith(1);
      expect(mockRoomRepository.createQueryBuilder().take).toHaveBeenCalledWith(1);
    });
  });

  describe('findRoomById', () => {
    it('should return a room if found', async () => {
      const mockRoom = {
        id: 'room-uuid',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      expect(loggerService.log).toHaveBeenCalledWith('Attempting to find room by ID: room-uuid', 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith('Room found with ID: room-uuid', 'WaitingRoomService');
    });

    it('should throw NotFoundException if room not found', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockRoomRepository.findOne.mockResolvedValue(null);
      await expect(service.findRoomById('non-existent-room')).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith('Room with ID "non-existent-room" not found.', 'WaitingRoomService');
    });

    it('should return a room from cache if available', async () => {
      const mockRoom = {
        id: 'room-uuid',
        name: 'Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(mockRoom); // Simulate cache hit
      mockRoomRepository.findOne.mockResolvedValue(mockRoom); // Should not be called

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith('room_room-uuid');
      expect(mockRoomRepository.findOne).not.toHaveBeenCalled(); // Verify cache hit
      expect(loggerService.log).toHaveBeenCalledWith('Room with ID: room-uuid found in cache.', 'WaitingRoomService');
    });

    it('should cache the room if not found in cache', async () => {
      const mockRoom = {
        id: 'room-uuid',
        name: 'New Cached Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockCacheManager.get.mockResolvedValue(null); // Simulate cache miss
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);
      mockCacheManager.set.mockResolvedValue(undefined);

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockCacheManager.get).toHaveBeenCalledWith('room_room-uuid');
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      expect(mockCacheManager.set).toHaveBeenCalledWith('room_room-uuid', mockRoom);
      expect(loggerService.log).toHaveBeenCalledWith('Room found with ID: room-uuid and cached.', 'WaitingRoomService');
    });
  });

  describe('updateRoom', () => {
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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const updatedRoom = { ...existingRoom, ...updateRoomDto } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom);
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

    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = {
        id: roomId,
        hostId: 'original-host-uuid',
        name: 'Old Name',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom);

      await expect(service.updateRoom(roomId, updateRoomDto, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to update room ${roomId} which they do not own.`, 'WaitingRoomService');
    });
  });

  describe('deleteRoom', () => {
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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      mockRoomPlayerRepository.delete.mockResolvedValue({ affected: 1 });
      mockRoomRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteRoom(roomId, hostId);
      expect(result).toEqual({ message: `Room with ID "${roomId}" successfully deleted.` });
      expect(mockRoomPlayerRepository.delete).toHaveBeenCalledWith({ roomId: roomId });
      expect(mockRoomRepository.delete).toHaveBeenCalledWith(roomId);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith({ id: roomId, status: RoomStatus.FINISHED });
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to delete room ${roomId} by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Room with ID "${roomId}" successfully deleted by host: ${hostId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to deletion.`, 'WaitingRoomService');
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      mockRoomPlayerRepository.delete.mockResolvedValue({ affected: 1 });
      mockRoomRepository.delete.mockResolvedValue({ affected: 0 }); // Simulate no rows affected

      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(NotFoundException);
      expect(loggerService.error).toHaveBeenCalledWith(`Room with ID "${roomId}" could not be deleted or was already deleted.`, 'WaitingRoomService');
    });

    it('should throw NotFoundException if room not found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);
      await expect(service.deleteRoom('non-existent-room', 'host-id')).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith('Room with ID "non-existent-room" not found for deletion.', 'WaitingRoomService');
    });
    
    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const existingRoom = {
        id: roomId,
        hostId: 'original-host-uuid',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`, 'WaitingRoomService');
    });
  });

  describe('joinRoom', () => {
    it('should allow a user to join a public room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Active Player Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null); // No existing player
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No active players
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});

      const result = await service.joinRoom(roomId, userId);
      expect(result).toEqual(mockRoom);
      expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
        roomId: roomId,
        userId: userId,
        status: RoomPlayerStatus.ACTIVE,
      });
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Attempting to join room ${roomId} by user: ${userId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} joined room ${roomId} as ACTIVE (public or no approval required).`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to join.`, 'WaitingRoomService');
    });

    it('should set player status to PENDING for private rooms requiring approval', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Pending Request Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId } as User;

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
        status: RoomPlayerStatus.PENDING,
      });
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} join request for room ${roomId} set to PENDING (private, approval required).`, 'WaitingRoomService');
    });

    it('should throw BadRequestException if room is full', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = {
        id: roomId,
        name: 'Full Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 1,
        status: RoomStatus.WAITING,
        hostId: 'host-uuid',
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Room is full

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(`Room ${roomId} is full. User ${userId} cannot join.`, 'WaitingRoomService');
    });

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
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.ACTIVE } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} is already an active player in room ${roomId}.`, 'WaitingRoomService');
    });

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
        host: { id: 'host-uuid', username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const mockUser = { id: userId } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
      expect(loggerService.warn).toHaveBeenCalledWith(`Join request already pending for user ${userId} in room ${roomId}.`, 'WaitingRoomService');
    });

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
            host: { id: 'host-uuid', username: 'hostuser' } as User,
            roomPlayers: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Room;
    
          jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
          mockUserRepository.findOneBy.mockResolvedValue(null);
    
          await expect(service.joinRoom(roomId, userId)).rejects.toThrow(NotFoundException);
          expect(loggerService.error).toHaveBeenCalledWith(`User with ID "${userId}" not found during join room operation.`, 'WaitingRoomService');
        });
    
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
            host: { id: 'host-uuid', username: 'hostuser' } as User,
            roomPlayers: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          } as Room;
          const mockUser = { id: userId } as User;
          const existingPlayer = { roomId, userId, status: RoomPlayerStatus.LEFT } as RoomPlayer; // Simulate a previously left player
    
          jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
          mockUserRepository.findOneBy.mockResolvedValue(mockUser);
          mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);
          mockRoomPlayerRepository.remove.mockResolvedValue(existingPlayer);
          mockRoomPlayerRepository.count.mockResolvedValue(0);
          mockRoomPlayerRepository.create.mockReturnValue({});
          mockRoomPlayerRepository.save.mockResolvedValue({});
    
          await service.joinRoom(roomId, userId);
          expect(mockRoomPlayerRepository.remove).toHaveBeenCalledWith(existingPlayer);
          expect(mockRoomPlayerRepository.create).toHaveBeenCalledWith({
            roomId: roomId,
            userId: userId,
            status: RoomPlayerStatus.ACTIVE,
          });
          expect(loggerService.log).toHaveBeenCalledWith(`Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`, 'WaitingRoomService');
        });
    });

  describe('approveOrDeclineJoinRequest', () => {
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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No active players
      mockRoomPlayerRepository.save.mockResolvedValue({ ...pendingRoomPlayer, status: RoomPlayerStatus.ACTIVE });

      const result = await service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId);
      expect(result).toEqual(mockRoom); // findRoomById is called at the end
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.ACTIVE);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(pendingRoomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Host ${hostId} attempting to ${JoinRequestDecision.APPROVE} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Join request for user ${pendingUserId} in room ${roomId} APPROVED.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
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
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.DECLINED);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(pendingRoomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`Host ${hostId} attempting to ${JoinRequestDecision.DECLINE} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Join request for user ${pendingUserId} in room ${roomId} DECLINED.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    });

    it('should throw ForbiddenException if not host', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'unauthorized-host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: 'original-host-uuid',
        name: 'Test Room',
        isPublic: false,
        approvalRequired: true,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(ForbiddenException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`, 'WaitingRoomService');
    });

    it('should throw BadRequestException if room does not require approval', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: hostId,
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`, 'WaitingRoomService');
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(NotFoundException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Join request for user "${pendingUserId}" in room ${roomId} not found or already processed.`, 'WaitingRoomService');
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Room is full

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.PENDING); // Status should not change
      expect(loggerService.warn).toHaveBeenCalledWith(`Cannot approve join request for user ${pendingUserId} in room ${roomId}: Room is full.`, 'WaitingRoomService');
    });
  });

  describe('leaveRoom', () => {
    it('should allow an active player to leave a room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host' } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.ACTIVE } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...roomPlayer, status: RoomPlayerStatus.LEFT });

      const result = await service.leaveRoom(roomId, userId);
      expect(result).toEqual(mockRoom);
      expect(roomPlayer.status).toBe(RoomPlayerStatus.LEFT);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(roomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
      expect(cacheManager.del).toHaveBeenCalledWith(`room_${roomId}`); // Verify cache invalidation
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} attempting to leave room: ${roomId}`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
      expect(loggerService.log).toHaveBeenCalledWith(`Cache for room ${roomId} invalidated due to leave.`, 'WaitingRoomService');
    });

    it('should allow a pending player to cancel their request', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host' } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...roomPlayer, status: RoomPlayerStatus.LEFT });

      await service.leaveRoom(roomId, userId);
      expect(roomPlayer.status).toBe(RoomPlayerStatus.LEFT);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(roomPlayer);
      expect(loggerService.log).toHaveBeenCalledWith(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
    });

    it('should throw BadRequestException if host tries to leave', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.leaveRoom(roomId, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Host ${hostId} attempted to leave room ${roomId} using player leave endpoint.`, 'WaitingRoomService');
    });

    it('should throw BadRequestException if user is not associated with room', async () => {
      const roomId = 'room-uuid';
      const userId = 'non-associated-user';
      const mockRoom = { id: roomId, hostId: 'host-id' } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} is not associated with room ${roomId}.`, 'WaitingRoomService');
    });

    it('should throw BadRequestException if user has already left or declined', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host' } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.LEFT } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`User ${userId} has already left or declined to join room ${roomId}.`, 'WaitingRoomService');
    });
  });

  describe('startGame', () => {
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
        status: RoomStatus.WAITING,
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // At least one player
      mockRoomRepository.save.mockResolvedValue({ ...mockRoom, status: RoomStatus.IN_PROGRESS });
      mockRoomPlayerRepository.update.mockResolvedValue({});

      const result = await service.startGame(roomId, hostId);
      expect(result.status).toBe(RoomStatus.IN_PROGRESS);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: RoomStatus.IN_PROGRESS }));
      expect(mockRoomPlayerRepository.update).toHaveBeenCalledWith(
        { roomId, status: RoomPlayerStatus.PENDING },
        { status: RoomPlayerStatus.DECLINED },
      );
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: RoomStatus.IN_PROGRESS }));
    });

    it('should throw ForbiddenException if not host', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const mockRoom = {
        id: roomId,
        hostId: 'original-host-uuid',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 10,
        status: RoomStatus.WAITING,
        host: { id: 'original-host-uuid', username: 'originalhost' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(ForbiddenException);
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No players

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Cannot start game in room ${roomId}: No active players.`, 'WaitingRoomService');
    });

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
        host: { id: hostId, username: 'hostuser' } as User,
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