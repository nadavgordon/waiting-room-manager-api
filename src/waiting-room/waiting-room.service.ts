import { Injectable, NotFoundException, BadRequestException, HttpException, HttpStatus, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';
import { StartGameDto } from './dto/start-game.dto';
import { DeleteRoomDto } from './dto/delete-room.dto';

@Injectable()
export class WaitingRoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto): Promise<Room> {
    const newRoom = this.roomRepository.create({
      ...createRoomDto,
      isPublic: createRoomDto.isPublic === undefined ? true : createRoomDto.isPublic,
      approvalRequired: createRoomDto.approvalRequired === undefined ? false : createRoomDto.approvalRequired,
      playerIds: [],
      pendingPlayerRequests: [],
      // status will default to 'waiting' as per entity definition
    });
    return this.roomRepository.save(newRoom);
  }

  async findAllRooms(userId?: string): Promise<Room[]> {
    const queryBuilder = this.roomRepository.createQueryBuilder('room');

    if (userId) {
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true })
        .orWhere('(room.isPublic = :isPublicFalse AND room.hostId = :currentUserId)', {
          isPublicFalse: false,
          currentUserId: userId,
        });
    } else {
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true });
    }

    return queryBuilder.getMany();
  }

  async findRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOneBy({ id });
    if (!room) {
      throw new NotFoundException(`Room with ID "${id}" not found`);
    }
    return room;
  }

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
    const room = await this.findRoomById(id); 
    Object.assign(room, updateRoomDto);
    return this.roomRepository.save(room);
  }

  async deleteRoom(roomId: string, hostId: string): Promise<{ message: string }> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the host can delete this room.');
    }

    const deleteResult = await this.roomRepository.delete(roomId);

    if (deleteResult.affected === 0) {
      // This case should ideally not be reached if findOne succeeded, but good for robustness
      throw new NotFoundException(`Room with ID "${roomId}" could not be deleted or was already deleted.`);
    }

    return { message: `Room with ID "${roomId}" successfully deleted.` };
  }

  async joinRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.findRoomById(roomId); // Leverages existing find and NotFoundException

    // Check if the user is the host
    if (room.hostId === userId) {
      throw new BadRequestException('Host cannot join the room as a player.');
    }

    // If the room is private and requires approval
    if (!room.isPublic && room.approvalRequired) {
      // Check if player is already pending
      if (room.pendingPlayerRequests.includes(userId)) {
        throw new BadRequestException('Join request already pending.');
      }
      // Check if player is already in the room (should be caught by pending check if they were approved)
      if (room.playerIds.includes(userId)) {
        throw new BadRequestException('Player already in room.');
      }
      // Add to pending requests
      room.pendingPlayerRequests.push(userId);
      await this.roomRepository.save(room);
      // Consider returning a specific status/message indicating request is pending
      // For now, returning the room state which shows the pending request.
      // Or throw a specific exception that the controller can catch to return 202 Accepted.
      // Let's throw a custom exception for now, or a specific message.
      // For simplicity, we'll return the room and the client can check pendingPlayerRequests.
      // A more RESTful approach might be a 202 Accepted with a link to the request status.
      return room; // Or throw new HttpException('Request to join is pending approval', HttpStatus.ACCEPTED);
    }

    // Check if room is full (only if not pending approval, as approval might fill it)
    if (room.playerIds.length >= room.maxPlayers) {
      throw new BadRequestException('Room is full.');
    }

    // Check if player is already in the room
    if (room.playerIds.includes(userId)) {
      throw new BadRequestException('Player already in room.');
    }

    // Add player to room
    room.playerIds.push(userId);
    return this.roomRepository.save(room);
  }

  async approveOrDeclineJoinRequest(
    roomId: string,
    pendingUserId: string,
    decision: JoinRequestDecision,
    hostUserId: string, // This will come from the authenticated user (e.g., JWT payload)
  ): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    // Verify the action is performed by the host
    if (room.hostId !== hostUserId) {
      throw new ForbiddenException('Only the room host can approve or decline join requests.');
    }

    // Check if the room actually requires approval
    if (!room.approvalRequired) {
      throw new BadRequestException('This room does not require approval for join requests.');
    }

    const requestIndex = room.pendingPlayerRequests.indexOf(pendingUserId);
    if (requestIndex === -1) {
      throw new BadRequestException(`Join request for user "${pendingUserId}" not found or already processed.`);
    }

    if (decision === JoinRequestDecision.APPROVE) {
      // Check if player is already in the room (should not happen if logic is correct, but good safeguard)
      if (room.playerIds.includes(pendingUserId)) {
        // Remove from pending if somehow still there and throw error or just log
        room.pendingPlayerRequests.splice(requestIndex, 1);
        await this.roomRepository.save(room);
        throw new BadRequestException(`Player "${pendingUserId}" is already in the room.`);
      }
      
      // Check room capacity before approving
      if (room.playerIds.length >= room.maxPlayers) {
        throw new BadRequestException('Cannot approve join request: Room is full.');
      }
      room.playerIds.push(pendingUserId);
    } else { // Decision is DECLINE
      // No action needed for playerIds, just remove from pending
    }

    // Remove from pending requests regardless of decision
    room.pendingPlayerRequests.splice(requestIndex, 1);

    return this.roomRepository.save(room);
  }

  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    // Prevent host from using this endpoint
    if (room.hostId === userId) {
      throw new BadRequestException('Host cannot leave the room using this endpoint. Hosts can delete their rooms.');
    }

    const playerIndex = room.playerIds.indexOf(userId);
    const pendingIndex = room.pendingPlayerRequests.indexOf(userId);

    if (playerIndex > -1) {
      room.playerIds.splice(playerIndex, 1);
    } else if (pendingIndex > -1) {
      room.pendingPlayerRequests.splice(pendingIndex, 1);
    } else {
      throw new BadRequestException('User is not an active player in this room nor has a pending join request.');
    }

    return this.roomRepository.save(room);
  }

  async startGame(roomId: string, hostId: string): Promise<Room> {
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    if (room.hostId !== hostId) {
      throw new ForbiddenException('Only the host can start the game.');
    }

    if (room.status !== RoomStatus.WAITING) {
      throw new BadRequestException(`Game cannot be started. Room status is currently '${room.status}'.`);
    }

    if (room.playerIds.length === 0) {
      throw new BadRequestException('Cannot start a game with no players.');
    }

    room.status = RoomStatus.IN_PROGRESS;
    room.pendingPlayerRequests = []; // Clear pending requests when game starts

    return this.roomRepository.save(room);
  }

  // Placeholder for changing room status, e.g., starting a game
  // async changeRoomStatus(roomId: string, newStatus: RoomStatus): Promise<Room> { ... }
}
