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

@Injectable() // Decorator that marks the class as a provider, making it available for injection.
export class WaitingRoomService {
  // The constructor injects necessary repositories, services, and the cache manager.
  constructor(
    @InjectRepository(Room) // Injects the TypeORM repository for the `Room` entity.
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer) // Injects the TypeORM repository for the `RoomPlayer` entity.
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(User) // Injects the TypeORM repository for the `User` entity.
    private readonly userRepository: Repository<User>,
    private readonly waitingRoomGateway: WaitingRoomGateway, // Injects the WebSocket gateway for real-time updates.
    private readonly logger: LoggerService, // Injects the custom structured logger.
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // Injects the cache manager (Redis).
  ) {}

  /**
   * Creates a new waiting room.
   * The host (creator) is automatically added as an active player.
   * @param createRoomDto Data Transfer Object containing room creation details.
   * @param hostId The ID of the user creating the room (host).
   * @returns The newly created Room entity with populated relations.
   * @throws NotFoundException if the host user is not found.
   */
  async createRoom(createRoomDto: CreateRoomDto, hostId: string): Promise<Room> {
    this.logger.log(`Attempting to create room for host: ${hostId}`, 'WaitingRoomService');
    // Find the host user by ID.
    const host = await this.userRepository.findOneBy({ id: hostId });
    if (!host) {
      this.logger.error(`Host with ID "${hostId}" not found during room creation.`, 'WaitingRoomService');
      throw new NotFoundException(`Host with ID "${hostId}" not found.`);
    }

    // Create a new Room entity instance.
    // Default `isPublic` to true and `approvalRequired` to false if not provided.
    const newRoom = this.roomRepository.create({
      ...createRoomDto,
      isPublic: createRoomDto.isPublic ?? true,
      approvalRequired: createRoomDto.approvalRequired ?? false,
      hostId: host.id, // Set the host ID.
      host: host, // Associate the host object.
    });
    // Save the new room to the database.
    const savedRoom = await this.roomRepository.save(newRoom);
    this.logger.log(`Room created with ID: ${savedRoom.id} by host: ${hostId}`, 'WaitingRoomService');

    // Add the host as an active player in the room.
    const hostRoomPlayer = this.roomPlayerRepository.create({
      roomId: savedRoom.id,
      userId: host.id,
      status: RoomPlayerStatus.ACTIVE, // Host is always an active player.
    });
    // Save the host's room player entry.
    await this.roomPlayerRepository.save(hostRoomPlayer);
    this.logger.log(`Host ${hostId} added as active player to room ${savedRoom.id}`, 'WaitingRoomService');

    // Emit a WebSocket update to notify clients about the new room.
    this.waitingRoomGateway.emitRoomUpdate(savedRoom);
    // Return the room with populated relations (host and roomPlayers) for a complete response.
    return this.findRoomById(savedRoom.id);
  }

  /**
   * Retrieves a paginated list of waiting rooms.
   * Filters rooms based on whether they are public or if the specified user is the host or an active player.
   * @param userId The ID of the current user (optional, for filtering).
   * @param page The page number to retrieve (defaults to 1).
   * @param limit The maximum number of rooms per page (defaults to 10).
   * @returns An object containing the array of Room entities and the total count of matching rooms.
   */
  async findAllRooms(userId: string, page: number = 1, limit: number = 10): Promise<{ rooms: Room[]; total: number }> {
    this.logger.log(`Fetching all rooms for user: ${userId || 'anonymous'} with page: ${page}, limit: ${limit}`, 'WaitingRoomService');
    // Create a query builder for the Room entity.
    const queryBuilder = this.roomRepository.createQueryBuilder('room')
      // Eagerly load related entities to avoid N+1 query problems.
      .leftJoinAndSelect('room.host', 'host') // Join with the host user.
      .leftJoinAndSelect('room.roomPlayers', 'roomPlayer') // Join with room players.
      .leftJoinAndSelect('roomPlayer.player', 'player'); // Join with the player details for each room player.

    // Apply filtering conditions based on whether a userId is provided.
    if (userId) {
      // If a user is authenticated, show public rooms, rooms hosted by the user,
      // or rooms where the user is an active player.
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true })
        .orWhere('room.hostId = :currentUserId', { currentUserId: userId })
        .orWhere('roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus', {
          currentUserId: userId,
          activeStatus: RoomPlayerStatus.ACTIVE,
        });
      this.logger.debug(`Querying for public rooms or rooms where user ${userId} is host/active player.`, 'WaitingRoomService');
    } else {
      // If no user is authenticated, only show public rooms.
      queryBuilder.where('room.isPublic = :isPublicTrue', { isPublicTrue: true });
      this.logger.debug('Querying for public rooms only (anonymous user).', 'WaitingRoomService');
    }

    // Apply pagination (skip and take) and execute the query to get rooms and their total count.
    const [rooms, total] = await queryBuilder
      .skip((page - 1) * limit) // Calculate the offset for pagination.
      .take(limit) // Limit the number of results per page.
      .getManyAndCount(); // Execute the query and get both results and total count.

    this.logger.log(`Found ${rooms.length} rooms (total: ${total}) for user: ${userId || 'anonymous'} on page ${page}.`, 'WaitingRoomService');
    return { rooms, total };
  }

  /**
   * Finds a single waiting room by its ID.
   * This method first attempts to retrieve the room from the Redis cache.
   * If not found in cache, it fetches from the database and then caches the result.
   * @param id The ID of the room to find.
   * @returns The Room entity with populated relations.
   * @throws NotFoundException if the room is not found.
   */
  async findRoomById(id: string): Promise<Room> {
    this.logger.log(`Attempting to find room by ID: ${id}`, 'WaitingRoomService');
    const cacheKey = `room_${id}`; // Define a unique cache key for the room.
    let room = await this.cacheManager.get<Room>(cacheKey); // Attempt to retrieve the room from cache.

    if (room) {
      this.logger.log(`Room with ID: ${id} found in cache.`, 'WaitingRoomService');
      return room; // Return cached room if available.
    }

    // If not in cache, fetch the room from the database with its related entities.
    room = await this.roomRepository.findOne({
      where: { id }, // Find by room ID.
      relations: ['host', 'roomPlayers', 'roomPlayers.player'], // Eagerly load host, room players, and their associated player details.
    });
    if (!room) {
      this.logger.warn(`Room with ID "${id}" not found.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${id}" not found`); // Throw if room is not found in DB.
    }
    // Cache the retrieved room for future requests.
    await this.cacheManager.set(cacheKey, room);
    this.logger.log(`Room found with ID: ${id} and cached.`, 'WaitingRoomService');
    return room;
  }

  /**
   * Updates an existing waiting room.
   * Only the room's host can update the room.
   * @param id The ID of the room to update.
   * @param updateRoomDto Data Transfer Object containing fields to update.
   * @param hostId The ID of the user attempting to update the room.
   * @returns The updated Room entity.
   * @throws NotFoundException if the room is not found.
   * @throws ForbiddenException if the user is not the host of the room.
   */
  async updateRoom(id: string, updateRoomDto: UpdateRoomDto, hostId: string): Promise<Room> {
    this.logger.log(`Attempting to update room ${id} by host: ${hostId}`, 'WaitingRoomService');
    // Find the room by ID. This also handles NotFoundException.
    const room = await this.findRoomById(id);
    // Check if the authenticated user is the host of the room.
    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to update room ${id} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can update this room.');
    }
    // Apply updates from the DTO to the room entity.
    Object.assign(room, updateRoomDto);
    // Save the updated room to the database.
    const updatedRoom = await this.roomRepository.save(room);
    this.logger.log(`Room ${id} updated successfully by host: ${hostId}`, 'WaitingRoomService');
    // Emit a WebSocket update to notify clients about the room change.
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${id}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${id} invalidated due to update.`, 'WaitingRoomService');
    return updatedRoom;
  }

  /**
   * Deletes a waiting room.
   * Only the room's host can delete the room.
   * All associated room players are also deleted due to cascade delete in the database.
   * @param roomId The ID of the room to delete.
   * @param hostId The ID of the user attempting to delete the room.
   * @returns A success message.
   * @throws NotFoundException if the room is not found or could not be deleted.
   * @throws ForbiddenException if the user is not the host of the room.
   */
  async deleteRoom(roomId: string, hostId: string): Promise<{ message: string }> {
    this.logger.log(`Attempting to delete room ${roomId} by host: ${hostId}`, 'WaitingRoomService');
    // Find the room by ID.
    const room = await this.roomRepository.findOne({ where: { id: roomId } });

    if (!room) {
      this.logger.warn(`Room with ID "${roomId}" not found for deletion.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${roomId}" not found`);
    }

    // Check if the authenticated user is the host of the room.
    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can delete this room.');
    }

    // Delete all room player entries associated with this room.
    // This is explicitly done here, though a cascade delete on the Room entity might also handle it.
    await this.roomPlayerRepository.delete({ roomId: roomId });
    // Delete the room from the database.
    const deleteResult = await this.roomRepository.delete(roomId);

    // Check if any rows were affected by the delete operation.
    if (deleteResult.affected === 0) {
      this.logger.error(`Room with ID "${roomId}" could not be deleted or was already deleted.`, 'WaitingRoomService');
      throw new NotFoundException(`Room with ID "${roomId}" could not be deleted or was already deleted.`);
    }

    this.logger.log(`Room with ID "${roomId}" successfully deleted by host: ${hostId}`, 'WaitingRoomService');
    // Emit a WebSocket update to signify the room's deletion (e.g., by setting status to FINISHED).
    this.waitingRoomGateway.emitRoomUpdate({ id: roomId, status: RoomStatus.FINISHED } as Room);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${roomId} invalidated due to deletion.`, 'WaitingRoomService');
    return { message: `Room with ID "${roomId}" successfully deleted.` };
  }

  /**
   * Allows a user to join a waiting room.
   * Handles various scenarios: user not found, host attempting to join as player,
   * existing player status (active, pending), room capacity, and approval requirements.
   * @param roomId The ID of the room to join.
   * @param userId The ID of the user attempting to join.
   * @returns The updated Room entity after the join operation.
   * @throws NotFoundException if the user is not found.
   * @throws BadRequestException for various invalid join scenarios (e.g., host joining, room full, already active/pending).
   */
  async joinRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(`Attempting to join room ${roomId} by user: ${userId}`, 'WaitingRoomService');
    // Retrieve room details, including relations, and user details.
    const room = await this.findRoomById(roomId); // This handles NotFoundException for the room.
    const user = await this.userRepository.findOneBy({ id: userId });

    if (!user) {
      this.logger.error(`User with ID "${userId}" not found during join room operation.`, 'WaitingRoomService');
      throw new NotFoundException(`User with ID "${userId}" not found.`);
    }

    // Prevent the room host from joining as a regular player.
    if (room.hostId === userId) {
      this.logger.warn(`Host ${userId} attempted to join room ${roomId} as a player.`, 'WaitingRoomService');
      throw new BadRequestException('Host is already part of the room and cannot join as a player.');
    }

    // Check for an existing RoomPlayer entry for this user in this room.
    const existingPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (existingPlayer) {
      // If the user is already an active player, prevent re-joining.
      if (existingPlayer.status === RoomPlayerStatus.ACTIVE) {
        this.logger.warn(`User ${userId} is already an active player in room ${roomId}.`, 'WaitingRoomService');
        throw new BadRequestException('Player is already in this room.');
      }
      // If a join request is already pending, prevent duplicate requests.
      if (existingPlayer.status === RoomPlayerStatus.PENDING) {
        this.logger.warn(`Join request already pending for user ${userId} in room ${roomId}.`, 'WaitingRoomService');
        throw new BadRequestException('Join request already pending for this room.');
      }
      // If the user had a previous status (e.g., LEFT, DECLINED), remove the old entry to allow a fresh join.
      this.logger.log(`Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`, 'WaitingRoomService');
      await this.roomPlayerRepository.remove(existingPlayer);
    }

    // Check if the room has reached its maximum player capacity.
    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    if (activePlayersCount >= room.maxPlayers) {
      this.logger.warn(`Room ${roomId} is full. User ${userId} cannot join.`, 'WaitingRoomService');
      throw new BadRequestException('Room is full.');
    }

    // Determine the new player's status based on the room's approval requirements.
    let newPlayerStatus: RoomPlayerStatus;
    if (room.approvalRequired) {
      newPlayerStatus = RoomPlayerStatus.PENDING; // If approval is required, status is PENDING.
      this.logger.log(`User ${userId} join request for room ${roomId} set to PENDING (approval required).`, 'WaitingRoomService');
    } else {
      newPlayerStatus = RoomPlayerStatus.ACTIVE; // Otherwise, status is ACTIVE.
      this.logger.log(`User ${userId} joined room ${roomId} as ACTIVE (no approval required).`, 'WaitingRoomService');
    }

    // Create and save the new RoomPlayer entry.
    const roomPlayer = this.roomPlayerRepository.create({
      roomId: room.id,
      userId: user.id,
      status: newPlayerStatus,
    });
    await this.roomPlayerRepository.save(roomPlayer);

    // Fetch the updated room with its new player list and emit a WebSocket update.
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${roomId} invalidated due to join.`, 'WaitingRoomService');
    return updatedRoom;
  }

  /**
   * Approves or declines a pending join request for a specific room.
   * This operation can only be performed by the room's host.
   * If approved, the player's status changes to ACTIVE, provided the room is not full.
   * If declined, the player's status changes to DECLINED.
   * @param roomId The ID of the room.
   * @param pendingUserId The ID of the user whose join request is being processed.
   * @param decision The decision to 'APPROVE' or 'DECLINE' the request.
   * @param hostId The ID of the user (host) making the decision.
   * @returns The updated Room entity.
   * @throws ForbiddenException if the user is not the room host.
   * @throws BadRequestException if the room does not require approval or is full upon approval attempt.
   * @throws NotFoundException if the pending join request is not found.
   */
  async approveOrDeclineJoinRequest(
    roomId: string,
    pendingUserId: string,
    decision: JoinRequestDecision,
    hostId: string,
  ): Promise<Room> {
    this.logger.log(`Host ${hostId} attempting to ${decision} join request for user ${pendingUserId} in room ${roomId}.`, 'WaitingRoomService');
    // Retrieve room details. This also handles NotFoundException for the room.
    const room = await this.findRoomById(roomId);
    this.logger.log(`[approveOrDeclineJoinRequest] Room found: ${room.id}, approvalRequired: ${room.approvalRequired}`, 'WaitingRoomService');

    // Ensure only the room host can approve/decline requests.
    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the room host can approve or decline join requests.');
    }

    // Ensure the room actually requires approval for join requests.
    if (!room.approvalRequired) {
      this.logger.warn(`Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`, 'WaitingRoomService');
      throw new BadRequestException('This room does not require approval for join requests.');
    }

    this.logger.log(`[approveOrDeclineJoinRequest] Checking for pending player: roomId=${roomId}, userId=${pendingUserId}`, 'WaitingRoomService');
    // Find the specific pending room player entry.
    const pendingRoomPlayer = await this.roomPlayerRepository.findOne({
      where: {
        roomId,
        userId: pendingUserId,
        status: RoomPlayerStatus.PENDING, // Crucially, only target pending requests.
      },
    });

    if (!pendingRoomPlayer) {
      this.logger.warn(`Join request for user "${pendingUserId}" in room ${roomId} not found or already processed.`, 'WaitingRoomService');
      throw new NotFoundException(`Join request for user "${pendingUserId}" not found or already processed.`);
    }

    // Process the decision (APPROVE or DECLINE).
    if (decision === JoinRequestDecision.APPROVE) {
      // If approving, check if the room has capacity for another active player.
      const activePlayersCount = await this.roomPlayerRepository.count({
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      if (activePlayersCount >= room.maxPlayers) {
        this.logger.warn(`Cannot approve join request for user ${pendingUserId} in room ${roomId}: Room is full.`, 'WaitingRoomService');
        throw new BadRequestException('Cannot approve join request: Room is full.');
      }
      // Change status to ACTIVE upon approval.
      pendingRoomPlayer.status = RoomPlayerStatus.ACTIVE;
      this.logger.log(`Join request for user ${pendingUserId} in room ${roomId} APPROVED.`, 'WaitingRoomService');
    } else {
      // Change status to DECLINED.
      pendingRoomPlayer.status = RoomPlayerStatus.DECLINED;
      this.logger.log(`Join request for user ${pendingUserId} in room ${roomId} DECLINED.`, 'WaitingRoomService');
    }

    // Save the updated RoomPlayer status.
    await this.roomPlayerRepository.save(pendingRoomPlayer);
    // Fetch the updated room and emit a WebSocket update.
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${roomId} invalidated due to approval/decline.`, 'WaitingRoomService');
    // Return the updated room, ensuring the latest state is reflected.
    return this.findRoomById(roomId);
  }

  /**
   * Allows a user to leave a waiting room.
   * Prevents the host from using this endpoint (hosts should delete the room instead).
   * Changes the player's status to 'LEFT'.
   * @param roomId The ID of the room to leave.
   * @param userId The ID of the user attempting to leave.
   * @returns The updated Room entity.
   * @throws NotFoundException if the room is not found.
   * @throws BadRequestException if the user is the host, not associated with the room, or has already left/declined.
   */
  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(`User ${userId} attempting to leave room: ${roomId}`, 'WaitingRoomService');
    // Retrieve room details. This also handles NotFoundException for the room.
    const room = await this.findRoomById(roomId);

    // Prevent the host from leaving the room as a player; they should delete the room.
    if (room.hostId === userId) {
      this.logger.warn(`Host ${userId} attempted to leave room ${roomId} using player leave endpoint.`, 'WaitingRoomService');
      throw new BadRequestException('Host cannot leave the room using this endpoint. Hosts can delete their rooms.');
    }

    // Find the RoomPlayer entry for the user in this room.
    const roomPlayer = await this.roomPlayerRepository.findOne({
      where: { roomId, userId },
    });

    if (!roomPlayer) {
      this.logger.warn(`User ${userId} is not associated with room ${roomId}.`, 'WaitingRoomService');
      throw new BadRequestException('User is not associated with this room.');
    }

    // Only allow leaving if the player is currently ACTIVE or PENDING.
    if (roomPlayer.status === RoomPlayerStatus.ACTIVE || roomPlayer.status === RoomPlayerStatus.PENDING) {
      roomPlayer.status = RoomPlayerStatus.LEFT; // Set status to LEFT.
      await this.roomPlayerRepository.save(roomPlayer); // Save the updated status.
      this.logger.log(`User ${userId} successfully left room ${roomId}.`, 'WaitingRoomService');
    } else {
      // If the user is already LEFT or DECLINED, prevent redundant actions.
      this.logger.warn(`User ${userId} has already left or declined to join room ${roomId}.`, 'WaitingRoomService');
      throw new BadRequestException('User has already left or declined to join this room.');
    }
    // Fetch the updated room and emit a WebSocket update.
    const updatedRoom = await this.findRoomById(roomId);
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${roomId} invalidated due to leave.`, 'WaitingRoomService');
    return updatedRoom;
  }

  /**
   * Initiates the game for a specific room, changing its status to 'IN_PROGRESS'.
   * This action can only be performed by the room's host and only if the room is in 'WAITING' status
   * and has at least one active player. All pending join requests are automatically declined.
   * @param roomId The ID of the room to start the game in.
   * @param hostId The ID of the user (host) attempting to start the game.
   * @returns The updated Room entity.
   * @throws NotFoundException if the room is not found.
   * @throws ForbiddenException if the user is not the room host.
   * @throws BadRequestException if the room is not in 'WAITING' status or has no active players.
   */
  async startGame(roomId: string, hostId: string): Promise<Room> {
    this.logger.log(`Host ${hostId} attempting to start game in room: ${roomId}`, 'WaitingRoomService');
    // Retrieve room details. This also handles NotFoundException for the room.
    const room = await this.findRoomById(roomId);

    // Ensure only the room host can start the game.
    if (room.hostId !== hostId) {
      this.logger.warn(`Forbidden: Host ${hostId} attempted to start game in room ${roomId} which they do not own.`, 'WaitingRoomService');
      throw new ForbiddenException('Only the host can start the game.');
    }

    // Ensure the room is in a 'WAITING' state before starting the game.
    if (room.status !== RoomStatus.WAITING) {
      this.logger.warn(`Game cannot be started in room ${roomId}. Current status: ${room.status}.`, 'WaitingRoomService');
      throw new BadRequestException(`Game cannot be started. Room status is currently '${room.status}'.`);
    }

    // Check if there are any active players in the room.
    const activePlayersCount = await this.roomPlayerRepository.count({
      where: { roomId, status: RoomPlayerStatus.ACTIVE },
    });

    // A game cannot start without any active players.
    if (activePlayersCount === 0) {
      this.logger.warn(`Cannot start game in room ${roomId}: No active players.`, 'WaitingRoomService');
      throw new BadRequestException('Cannot start a game with no players.');
    }

    // Update the room status to 'IN_PROGRESS'.
    room.status = RoomStatus.IN_PROGRESS;
    this.logger.log(`Game started in room ${roomId}. Status set to IN_PROGRESS.`, 'WaitingRoomService');

    // Decline all pending join requests for this room as the game is starting.
    await this.roomPlayerRepository.update(
      { roomId, status: RoomPlayerStatus.PENDING },
      { status: RoomPlayerStatus.DECLINED },
    );
    this.logger.log(`All pending join requests for room ${roomId} declined.`, 'WaitingRoomService');

    // Save the updated room status.
    const updatedRoom = await this.roomRepository.save(room);
    // Emit a WebSocket update to notify clients about the game start.
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
    this.logger.log(`Cache for room ${roomId} invalidated due to game start.`, 'WaitingRoomService');
    return updatedRoom;
  }
}
