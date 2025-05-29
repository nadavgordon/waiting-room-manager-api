import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomPlayer } from './entities/room-player.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { User } from '../user/entities/user.entity';
import { RoomPlayerStatus } from './enums/room-player-status.enum';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class WaitingRoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly waitingRoomGateway: WaitingRoomGateway,
    private readonly logger: LoggerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto, hostId: string): Promise<Room> {
    this.logger.log(`Attempting to create room for host: ${hostId}`, 'WaitingRoomService');
    const host = await this.userRepository.findOneBy({ id: hostId });
    if (!host) {
      this.logger.error(`Host with ID "${hostId}" not found during room creation.`, 'WaitingRoomService');
      throw new NotFoundException(`Host with ID "${hostId}" not found.`);
    }

    const newRoom = this.roomRepository.create({
      ...createRoomDto,
      isPublic: createRoomDto.isPublic ?? true,
      approvalRequired: createRoomDto.approvalRequired ?? false,
      hostId: host.id,
      host: host,
    });
    const savedRoom = await this.roomRepository.save(newRoom);
    this.logger.log(`Room created with ID: ${savedRoom.id} by host: ${hostId}`, 'WaitingRoomService');

    // Add the host as an active player in the room
    const hostRoomPlayer = this.roomPlayerRepository.create({
      roomId: savedRoom.id,
      userId: host.id,
      status: RoomPlayerStatus.ACTIVE,
    });
    await this.roomPlayerRepository.save(hostRoomPlayer);
    this.logger.log(`Host ${hostId} added as active player to room ${savedRoom.id}`, 'WaitingRoomService');

    this.waitingRoomGateway.emitRoomUpdate(savedRoom);
    return this.findRoomById(savedRoom.id); // Return the room with populated relations
  }

  async findAllRooms(userId: string, page: number = 1, limit: number = 10): Promise<{ rooms: Room[]; total: number }> {
    this.logger.log(`Fetching all rooms for user: ${userId || 'anonymous'} with page: ${page}, limit: ${limit}`, 'WaitingRoomService');
    const queryBuilder = this.roomRepository.createQueryBuilder('room')
      .leftJoinAndSelect('room.host', 'host')
      .leftJoinAndSelect('room.roomPlayers', 'roomPlayer')
      .leftJoinAndSelect('roomPlayer.player', 'player');

    if (userId) {
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true })
        .orWhere('room.hostId = :currentUserId', { currentUserId: userId })
        .orWhere('roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus', {
          currentUserId: userId,
          activeStatus: RoomPlayerStatus.ACTIVE,
        });
      this.logger.debug(`Querying for public rooms or rooms where user ${userId} is host/active player.`, 'WaitingRoomService');
    } else {
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      this.logger.debug('Querying for public rooms only (anonymous user).', 'WaitingRoomService');
    }

    const [rooms, total] = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    this.logger.log(`Found ${rooms.length} rooms (total: ${total}) for user: ${userId || 'anonymous'} on page ${page}.`, 'WaitingRoomService');
    return { rooms, total };
  }

  async findRoomById(id: string): Promise<Room> {
    this.logger.log(`Attempting to find room by ID: ${id}`, 'WaitingRoomService');
    const cacheKey = `room_${id}`;
    let room = await this.cacheManager.get<Room>(cacheKey);

    if (room) {
      this.logger.log(`Room with ID: ${id} found in cache.`, 'WaitingRoomService');
      return room;
    }

    room = await this.roomRepository.findOne({
      where: { id },
      relations: ['host', 'roomPlayers', 'roomPlayers.player'],
    });
    if (!room) {
      this.logger.warn(`Room with ID "${id}" not found.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${id}" not found`);
    }
    await this.cacheManager.set(cacheKey, room);
    this.logger.log(`Room found with ID: ${id} and cached.`, 'WaitingRoomService');
    return room;
  }

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto, hostId: string): Promise<Room> {
    this.logger.log(`Attempting to update room ${id} by host: ${hostId}`, 'WaitingRoomService');
    const room = await this.findRoomById(id);
    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to update room ${id} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can update this room.');
    }
    Object.assign(room, updateRoomDto);
    const updatedRoom = await this.roomRepository.save(room);
    this.logger.log(`Room ${id} updated successfully by host: ${hostId}`, 'WaitingRoomService');
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${id}`); // Invalidate cache on update
    this.logger.log(`Cache for room ${id} invalidated due to update.`, 'WaitingRoomService');
    return updatedRoom;
  }

  async deleteRoom(roomId: string, hostId: string): Promise<{ message: string }> {
    this.logger.log(`Attempting to delete room ${roomId} by host: ${hostId}`, 'WaitingRoomService');
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      this.logger.warn(`Room with ID "${roomId}" not found for deletion.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can delete this room.');
    }

    await this.roomPlayerRepository.delete({ roomId: roomId });
    const deleteResult = await this.roomRepository.delete(roomId);

    if (deleteResult.affected === 0) {
      this.logger.error(`Room with ID "${roomId}" could not be deleted or was already deleted.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${roomId}" could not be deleted or was already deleted.`);
    }

    this.logger.log(`Room with ID "${roomId}" successfully deleted by host: ${hostId}`, 'WaitingRoomService');
    this.waitingRoomGateway.emitRoomUpdate({ id: roomId, status: RoomStatus.FINISHED } as Room);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate cache on delete
    this.logger.log(`Cache for room ${roomId} invalidated due to deletion.`, 'WaitingRoomService');
    return { message: `Room with ID "${roomId}" successfully deleted.` };
  }

  async joinRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(`Attempting to join room ${roomId} by user: ${userId}`, 'WaitingRoomService');
    const room = await this.findRoomById(roomId);
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      this.logger.error(`User with ID "${userId}" not found during join room operation.`, 'WaitingRoomService');
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    if (room.hostId === userId) {
      this.logger.warn(`Host ${userId} attempted to join room ${roomId} as a player.`, 'WaitingRoomService');
      throw new BadRequestException('Host is already part of the room and cannot join as a player.');
    }

    const existingPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (existingPlayer) {
      if (existingPlayer.status === RoomPlayerStatus.ACTIVE) {
        this.logger.warn(`User ${userId} is already an active player in room ${roomId}.`, 'WaitingRoomService');
        throw new BadRequestException('Player is already in this room.');
      }
      if (existingPlayer.status === RoomPlayerStatus.PENDING) {
        this.logger.warn(`Join request already pending for user ${userId} in room ${roomId}.`, 'WaitingRoomService');
        throw new BadRequestException('Join request already pending for this room.');
      }
      this.logger.log(`Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`, 'WaitingRoomService');
      await this.roomPlayerRepository.remove(existingPlayer);
    }

    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    if (activePlayersCount >= room.maxPlayers) {
      this.logger.warn(`Room ${roomId} is full. User ${userId} cannot join.`, 'WaitingRoomService');
      throw new BadRequestException('Room is full.');
    }

    let newPlayerStatus: RoomPlayerStatus;
    if (!room.isPublic && room.approvalRequired) {
      newPlayerStatus = RoomPlayerStatus.PENDING;
      this.logger.log(`User ${userId} join request for room ${roomId} set to PENDING (private, approval required).`, 'WaitingRoomService');
    } else {
      newPlayerStatus = RoomPlayerStatus.ACTIVE;
      this.logger.log(`User ${userId} joined room ${roomId} as ACTIVE (public or no approval required).`, 'WaitingRoomService');
    }

    const roomPlayer = this.roomPlayerRepository.create({
      roomId: room.id,
      userId: user.id,
      status: newPlayerStatus,
    });
    await this.roomPlayerRepository.save(roomPlayer);
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate cache on join
    this.logger.log(`Cache for room ${roomId} invalidated due to join.`, 'WaitingRoomService');
    return updatedRoom;
  }

  async approveOrDeclineJoinRequest(
    roomId: string,
    pendingUserId: string,
    decision: JoinRequestDecision,
    hostId: string,
  ): Promise<Room> {
    this.logger.log(`Host ${hostId} attempting to ${decision} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
    const room = await this.findRoomById(roomId);
    this.logger.log(`[approveOrDeclineJoinRequest] Room found: ${room.id}, approvalRequired: ${room.approvalRequired}`, 'WaitingRoomService');

    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the room host can approve or decline join requests.');
    }

    if (!room.approvalRequired) {
      this.logger.warn(`Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`, 'WaitingRoomService');
      throw new BadRequestException('This room does not require approval for join requests.');
    }

    this.logger.log(`[approveOrDeclineJoinRequest] Checking for pending player: roomId=${roomId}, userId=${pendingUserId}`, 'WaitingRoomService');
    const pendingRoomPlayer = await this.roomPlayerRepository.findOne({
      where: {
        roomId,
        userId: pendingUserId,
        status: RoomPlayerStatus.PENDING,
      },
    });

    if (!pendingRoomPlayer) {
      this.logger.warn(`Join request for user "${pendingUserId}" in room ${roomId} not found or already processed.`, 'WaitingRoomService');
      throw new NotFoundException(`Join request for user "${pendingUserId}" not found or already processed.`);
    }

    if (decision === JoinRequestDecision.APPROVE) {
      const activePlayersCount = await this.roomPlayerRepository.count({
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      if (activePlayersCount >= room.maxPlayers) {
        this.logger.warn(`Cannot approve join request for user ${pendingUserId} in room ${roomId}: Room is full.`, 'WaitingRoomService');
        throw new BadRequestException('Cannot approve join request: Room is full.');
      }
      pendingRoomPlayer.status = RoomPlayerStatus.ACTIVE;
      this.logger.log(`Join request for user ${pendingUserId} in room ${roomId} APPROVED.`, 'WaitingRoomService');
    } else {
      pendingRoomPlayer.status = RoomPlayerStatus.DECLINED;
      this.logger.log(`Join request for user ${pendingUserId} in room ${roomId} DECLINED.`, 'WaitingRoomService');
    }

    await this.roomPlayerRepository.save(pendingRoomPlayer);
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate cache on approval/decline
    this.logger.log(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    return this.findRoomById(roomId);
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(`User ${userId} attempting to leave room: ${roomId}`, 'WaitingRoomService');
    const room = await this.findRoomById(roomId);

    if (room.hostId === userId) {
      this.logger.warn(`Host ${userId} attempted to leave room ${roomId} using player leave endpoint.`, 'WaitingRoomService');
      throw new BadRequestException('Host cannot leave the room using this endpoint. Hosts can delete their rooms.');
    }

    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (!roomPlayer) {
      this.logger.warn(`User ${userId} is not associated with room ${roomId}.`, 'WaitingRoomService');
      throw new BadRequestException('User is not associated with this room.');
    }

    if (roomPlayer.status === RoomPlayerStatus.ACTIVE || roomPlayer.status === RoomPlayerStatus.PENDING) {
      roomPlayer.status = RoomPlayerStatus.LEFT;
      await this.roomPlayerRepository.save(roomPlayer);
      this.logger.log(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
    } else {
      this.logger.warn(`User ${userId} has already left or declined to join room ${roomId}.`, 'WaitingRoomService');
      throw new BadRequestException('User has already left or declined to join this room.');
    }
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate cache on leave
    this.logger.log(`Cache for room ${roomId} invalidated due to leave.`, 'WaitingRoomService');
    return updatedRoom;
  }

  async startGame(roomId: string, hostId: string): Promise<Room> {
    this.logger.log(`Host ${hostId} attempting to start game in room: ${roomId}`, 'WaitingRoomService');
    const room = await this.findRoomById(roomId);

    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to start game in room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can start the game.');
    }

    if (room.status !== RoomStatus.WAITING) {
      this.logger.warn(`Game cannot be started in room ${roomId}. Current status: ${room.status}.`, 'WaitingRoomService');
      throw new BadRequestException(`Game cannot be started. Room status is currently '${room.status}'.`);
    }

    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    if (activePlayersCount === 0) {
      this.logger.warn(`Cannot start game in room ${roomId}: No active players.`, 'WaitingRoomService');
      throw new BadRequestException('Cannot start a game with no players.');
    }

    room.status = RoomStatus.IN_PROGRESS;
    this.logger.log(`Game started in room ${roomId}. Status set to IN_PROGRESS.`, 'WaitingRoomService');
    await this.roomPlayerRepository.update(
      { roomId, status: RoomPlayerStatus.PENDING },
      { status: RoomPlayerStatus.DECLINED },
    );
    this.logger.log(`All pending join requests for room ${roomId} declined.`, 'WaitingRoomService');

    const updatedRoom = await this.roomRepository.save(room);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate cache on game start
    this.logger.log(`Cache for room ${roomId} invalidated due to game start.`, 'WaitingRoomService');
    return updatedRoom;
  }
}
