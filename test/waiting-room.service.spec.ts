import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomService } from '../src/waiting-room/waiting-room.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { RoomPlayer } from '../src/waiting-room/entities/room-player.entity';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { User } from '../src/user/entities/user.entity';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { JoinRequestDecision } from '../src/waiting-room/dto/respond-to-join-request.dto';

describe('WaitingRoomService', () => {
  let service: WaitingRoomService;
  let roomRepository: Repository<Room>;
  let roomPlayerRepository: Repository<RoomPlayer>;
  let userRepository: Repository<User>;
  let waitingRoomGateway: WaitingRoomGateway;

  const mockRoomRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(null),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getOne: jest.fn(), // Added getOne as it's commonly used with findOne
    })),
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
      ],
    }).compile();

    service = module.get<WaitingRoomService>(WaitingRoomService);
    roomRepository = module.get<Repository<Room>>(getRepositoryToken(Room));
    roomPlayerRepository = module.get<Repository<RoomPlayer>>(getRepositoryToken(RoomPlayer));
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    waitingRoomGateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
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
      const mockRoom = { id: 'room-uuid', ...createRoomDto, hostId: hostId, host: mockHost, status: RoomStatus.WAITING };

      mockUserRepository.findOneBy.mockResolvedValue(mockHost);
      mockRoomRepository.create.mockReturnValue(mockRoom);
      mockRoomRepository.save.mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.create.mockReturnValue({});
      mockRoomPlayerRepository.save.mockResolvedValue({});
      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom as Room);

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
      expect(result).toEqual(mockRoom);
    });

    it('should throw NotFoundException if host not found', async () => {
      mockUserRepository.findOneBy.mockResolvedValue(null);
      const createRoomDto = { name: 'Test Room', maxPlayers: 4, isPublic: true, approvalRequired: false };
      const hostId = 'non-existent-host';

      await expect(service.createRoom(createRoomDto, hostId)).rejects.toThrow(NotFoundException);
      expect(mockUserRepository.findOneBy).toHaveBeenCalledWith({ id: hostId });
    });
  });

  describe('findAllRooms', () => {
    it('should return all public rooms if no userId is provided', async () => {
      const mockRooms = [
        { id: 'room1', name: 'Public Room 1', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'room2', name: 'Public Room 2', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host2', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      mockRoomRepository.createQueryBuilder().getMany.mockResolvedValue(mockRooms);

      const result = await service.findAllRooms();
      expect(result).toEqual(mockRooms);
     expect(mockRoomRepository.createQueryBuilder().where).toHaveBeenCalledWith('room.isPublic = :isPublicTrue', { isPublicTrue: true });
    });

    it('should return public rooms and rooms where user is host or active player if userId is provided', async () => {
      const userId = 'user-id';
      const mockRooms = [
        { id: 'room1', name: 'Public Room 1', isPublic: true, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host1', createdAt: new Date(), updatedAt: new Date() },
        { id: 'room2', name: 'Private Room Host', isPublic: false, approvalRequired: true, maxPlayers: 10, status: RoomStatus.WAITING, hostId: userId, createdAt: new Date(), updatedAt: new Date() },
        { id: 'room3', name: 'Private Room Player', isPublic: false, approvalRequired: false, maxPlayers: 10, status: RoomStatus.WAITING, hostId: 'host3', createdAt: new Date(), updatedAt: new Date() },
      ] as Room[];
      mockRoomRepository.createQueryBuilder().getMany.mockResolvedValue(mockRooms);

      const result = await service.findAllRooms(userId);
      expect(result).toEqual(mockRooms);
      expect(mockRoomRepository.createQueryBuilder().where).toHaveBeenCalledWith('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      expect(mockRoomRepository.createQueryBuilder().orWhere).toHaveBeenCalledWith('room.hostId = :currentUserId', { currentUserId: userId });
      expect(mockRoomRepository.createQueryBuilder().orWhere).toHaveBeenCalledWith('roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus', {
        currentUserId: userId,
        activeStatus: RoomPlayerStatus.ACTIVE,
      });
    });
  });

  describe('findRoomById', () => {
    it('should return a room if found', async () => {
      const mockRoom = { id: 'room-uuid' } as Room;
      mockRoomRepository.findOne.mockResolvedValue(mockRoom);

      const result = await service.findRoomById('room-uuid');
      expect(result).toEqual(mockRoom);
      expect(mockRoomRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'room-uuid' },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
    });

    it('should throw NotFoundException if room not found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);
      await expect(service.findRoomById('non-existent-room')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRoom', () => {
    it('should update a room if host is authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = { id: roomId, hostId: hostId, name: 'Old Name' } as Room;
      const updatedRoom = { ...existingRoom, ...updateRoomDto } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom);
      mockRoomRepository.save.mockResolvedValue(updatedRoom);

      const result = await service.updateRoom(roomId, updateRoomDto, hostId);
      expect(result).toEqual(updatedRoom);
      expect(mockRoomRepository.save).toHaveBeenCalledWith(updatedRoom);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(updatedRoom);
    });

    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const updateRoomDto = { name: 'Updated Room' };
      const existingRoom = { id: roomId, hostId: 'original-host-uuid', name: 'Old Name' } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(existingRoom);

      await expect(service.updateRoom(roomId, updateRoomDto, hostId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRoom', () => {
    it('should delete a room if host is authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const existingRoom = { id: roomId, hostId: hostId } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      mockRoomPlayerRepository.delete.mockResolvedValue({ affected: 1 });
      mockRoomRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.deleteRoom(roomId, hostId);
      expect(result).toEqual({ message: `Room with ID "${roomId}" successfully deleted.` });
      expect(mockRoomPlayerRepository.delete).toHaveBeenCalledWith({ roomId: roomId });
      expect(mockRoomRepository.delete).toHaveBeenCalledWith(roomId);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith({ id: roomId, status: RoomStatus.FINISHED });
    });

    it('should throw NotFoundException if room not found', async () => {
      mockRoomRepository.findOne.mockResolvedValue(null);
      await expect(service.deleteRoom('non-existent-room', 'host-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if host is not authorized', async () => {
      const roomId = 'room-uuid';
      const hostId = 'unauthorized-host-uuid';
      const existingRoom = { id: roomId, hostId: 'original-host-uuid' } as Room;

      mockRoomRepository.findOne.mockResolvedValue(existingRoom);
      await expect(service.deleteRoom(roomId, hostId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('joinRoom', () => {
    it('should allow a user to join a public room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, isPublic: true, approvalRequired: false, maxPlayers: 10 } as Room;
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
    });

    it('should set player status to PENDING for private rooms requiring approval', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, isPublic: false, approvalRequired: true, maxPlayers: 10 } as Room;
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
    });

    it('should throw BadRequestException if room is full', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, isPublic: true, approvalRequired: false, maxPlayers: 1 } as Room;
      const mockUser = { id: userId } as User;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Room is full

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if player is already active in room', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, isPublic: true, approvalRequired: false, maxPlayers: 10 } as Room;
      const mockUser = { id: userId } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.ACTIVE } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if join request is already pending', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, isPublic: false, approvalRequired: true, maxPlayers: 10 } as Room;
      const mockUser = { id: userId } as User;
      const existingPlayer = { roomId, userId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockUserRepository.findOneBy.mockResolvedValue(mockUser);
      mockRoomPlayerRepository.findOne.mockResolvedValue(existingPlayer);

      await expect(service.joinRoom(roomId, userId)).rejects.toThrow(BadRequestException);
      expect(mockRoomPlayerRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('approveOrDeclineJoinRequest', () => {
    it('should approve a pending join request', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, approvalRequired: true, maxPlayers: 10 } as Room;
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
    });

    it('should decline a pending join request', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, approvalRequired: true } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.save.mockResolvedValue({ ...pendingRoomPlayer, status: RoomPlayerStatus.DECLINED });

      const result = await service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.DECLINE, hostId);
      expect(result).toEqual(mockRoom);
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.DECLINED);
      expect(mockRoomPlayerRepository.save).toHaveBeenCalledWith(pendingRoomPlayer);
      expect(waitingRoomGateway.emitRoomUpdate).toHaveBeenCalledWith(mockRoom);
    });

    it('should throw ForbiddenException if not host', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'unauthorized-host-uuid';
      const mockRoom = { id: roomId, hostId: 'original-host-uuid', approvalRequired: true } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if room does not require approval', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, approvalRequired: false } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if pending request not found', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'non-existent-pending-user';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, approvalRequired: true } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if room is full on approval', async () => {
      const roomId = 'room-uuid';
      const pendingUserId = 'pending-user-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, approvalRequired: true, maxPlayers: 1 } as Room;
      const pendingRoomPlayer = { roomId, userId: pendingUserId, status: RoomPlayerStatus.PENDING } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(pendingRoomPlayer);
      mockRoomPlayerRepository.count.mockResolvedValue(1); // Room is full

      await expect(service.approveOrDeclineJoinRequest(roomId, pendingUserId, JoinRequestDecision.APPROVE, hostId)).rejects.toThrow(BadRequestException);
      expect(pendingRoomPlayer.status).toBe(RoomPlayerStatus.PENDING); // Status should not change
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
    });

    it('should throw BadRequestException if host tries to leave', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.leaveRoom(roomId, hostId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user is not associated with room', async () => {
      const roomId = 'room-uuid';
      const userId = 'non-associated-user';
      const mockRoom = { id: roomId, hostId: 'host-id' } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(null);

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if user has already left or declined', async () => {
      const roomId = 'room-uuid';
      const userId = 'player-uuid';
      const mockRoom = { id: roomId, hostId: 'another-host' } as Room;
      const roomPlayer = { roomId, userId, status: RoomPlayerStatus.LEFT } as RoomPlayer;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.findOne.mockResolvedValue(roomPlayer);

      await expect(service.leaveRoom(roomId, userId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('startGame', () => {
    it('should start the game if host is authorized and room is waiting', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, status: RoomStatus.WAITING } as Room;

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
      const mockRoom = { id: roomId, hostId: 'original-host-uuid', status: RoomStatus.WAITING } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if room is not in WAITING status', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, status: RoomStatus.IN_PROGRESS } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no players in room', async () => {
      const roomId = 'room-uuid';
      const hostId = 'host-uuid';
      const mockRoom = { id: roomId, hostId: hostId, status: RoomStatus.WAITING } as Room;

      jest.spyOn(service, 'findRoomById').mockResolvedValue(mockRoom);
      mockRoomPlayerRepository.count.mockResolvedValue(0); // No players

      await expect(service.startGame(roomId, hostId)).rejects.toThrow(BadRequestException);
    });
  });
});