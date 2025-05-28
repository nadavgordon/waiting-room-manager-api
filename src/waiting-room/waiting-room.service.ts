import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
  ) {}

  async createRoom(createRoomDto: CreateRoomDto, hostId: string): Promise<Room> {
    const host = await this.userRepository.findOneBy({ id: hostId });
    if (!host) {
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

    // Add the host as an active player in the room
    const hostRoomPlayer = this.roomPlayerRepository.create({
      roomId: savedRoom.id,
      userId: host.id,
      status: RoomPlayerStatus.ACTIVE,
    });
    await this.roomPlayerRepository.save(hostRoomPlayer);

    this.waitingRoomGateway.emitRoomUpdate(savedRoom);
    return this.findRoomById(savedRoom.id); // Return the room with populated relations
  }

  async findAllRooms(userId?: string): Promise<Room[]> {
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
    } else {
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true });
    }

    return queryBuilder.getMany();
  }

  async findRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOne({
      where: { id },
      relations: ['host', 'roomPlayers', 'roomPlayers.player'],
    });
    if (!room) {
      throw new NotFoundException(`Room with ID "${id}" not found`);
    }
    return room;
  }

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto, hostId: string): Promise<Room> {
    const room = await this.findRoomById(id);
    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the host can update this room.');
    }
    Object.assign(room, updateRoomDto);
    const updatedRoom = await this.roomRepository.save(room);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(roomId: string, hostId: string): Promise<{ message: string }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the host can delete this room.');
    }

    // Cascade delete should handle roomPlayers, but explicitly deleting them first is safer
    await this.roomPlayerRepository.delete({ roomId: roomId });
    const deleteResult = await this.roomRepository.delete(roomId);

    if (deleteResult.affected === 0) {
      throw new NotFoundException(`Room with ID "${roomId}" could not be deleted or was already deleted.`);
    }

    this.waitingRoomGateway.emitRoomUpdate({ id: roomId, status: RoomStatus.FINISHED } as Room); // Emit a simplified update for deletion
    return { message: `Room with ID "${roomId}" successfully deleted.` };
  }

  async joinRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.findRoomById(roomId);
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // Check if the user is the host
    if (room.hostId === userId) {
      throw new BadRequestException('Host is already part of the room and cannot join as a player.');
    }

    // Check if user is already an active player or has a pending request
    const existingPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (existingPlayer) {
      if (existingPlayer.status === RoomPlayerStatus.ACTIVE) {
        throw new BadRequestException('Player is already in this room.');
      }
      if (existingPlayer.status === RoomPlayerStatus.PENDING) {
        throw new BadRequestException('Join request already pending for this room.');
      }
      // If status is DECLINED or LEFT, we can allow a new request/join
      await this.roomPlayerRepository.remove(existingPlayer); // Remove old entry to create a new one
    }

    // Check room capacity
    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    if (activePlayersCount >= room.maxPlayers) {
      throw new BadRequestException('Room is full.');
    }

    let newPlayerStatus: RoomPlayerStatus;
    if (!room.isPublic && room.approvalRequired) {
      newPlayerStatus = RoomPlayerStatus.PENDING;
    } else {
      newPlayerStatus = RoomPlayerStatus.ACTIVE;
    }

    const roomPlayer = this.roomPlayerRepository.create({
      roomId: room.id,
      userId: user.id,
      status: newPlayerStatus,
    });
    await this.roomPlayerRepository.save(roomPlayer);
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    return updatedRoom;
  }

  async approveOrDeclineJoinRequest(
    roomId: string,
    pendingUserId: string,
    decision: JoinRequestDecision,
    hostId: string,
  ): Promise<Room> {
    const room = await this.findRoomById(roomId);

    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the room host can approve or decline join requests.');
    }

    if (!room.approvalRequired) {
      throw new BadRequestException('This room does not require approval for join requests.');
    }

    const pendingRoomPlayer = await this.roomPlayerRepository.findOne({
      where: {
        roomId,
        userId: pendingUserId,
        status: RoomPlayerStatus.PENDING,
      },
    });

    if (!pendingRoomPlayer) {
      throw new NotFoundException(`Join request for user "${pendingUserId}" not found or already processed.`);
    }

    if (decision === JoinRequestDecision.APPROVE) {
      const activePlayersCount = await this.roomPlayerRepository.count({
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      if (activePlayersCount >= room.maxPlayers) {
        throw new BadRequestException('Cannot approve join request: Room is full.');
      }
      pendingRoomPlayer.status = RoomPlayerStatus.ACTIVE;
    } else {
      pendingRoomPlayer.status = RoomPlayerStatus.DECLINED;
    }

    await this.roomPlayerRepository.save(pendingRoomPlayer);
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    return this.findRoomById(roomId);
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.findRoomById(roomId);

    if (room.hostId === userId) {
      throw new BadRequestException('Host cannot leave the room using this endpoint. Hosts can delete their rooms.');
    }

    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (!roomPlayer) {
      throw new BadRequestException('User is not associated with this room.');
    }

    if (roomPlayer.status === RoomPlayerStatus.ACTIVE || roomPlayer.status === RoomPlayerStatus.PENDING) {
      roomPlayer.status = RoomPlayerStatus.LEFT;
      await this.roomPlayerRepository.save(roomPlayer);
    } else {
      throw new BadRequestException('User has already left or declined to join this room.');
    }
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    return updatedRoom;
  }

  async startGame(roomId: string, hostId: string): Promise<Room> {
    const room = await this.findRoomById(roomId);

    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the host can start the game.');
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException(`Game cannot be started. Room status is currently '${room.status}'.`);
    }

    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    if (activePlayersCount === 0) {
      throw new BadRequestException('Cannot start a game with no players.');
    }

    room.status = RoomStatus.IN_PROGRESS;
    // Optionally, decline all pending requests when game starts
    await this.roomPlayerRepository.update(
      { roomId, status: RoomPlayerStatus.PENDING },
      { status: RoomPlayerStatus.DECLINED },
    );

    const updatedRoom = await this.roomRepository.save(room);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    return updatedRoom;
  }
}
