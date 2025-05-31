import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
    private dataSource: DataSource, // Injects the TypeORM DataSource for transaction management.
  ) {}

  /**
   * Creates a new waiting room and adds the host as an active player within a transaction.
   * Ensures atomicity of Room and RoomPlayer creation.
   * @param createRoomDto Data Transfer Object containing room creation details.
   * @param hostId The ID of the user creating the room (host).
   * @returns The newly created Room entity with populated relations.
   * @throws NotFoundException if the host user is not found.
   * @throws Error if the transaction fails.
   */
  async createRoom(
    createRoomDto: CreateRoomDto,
    hostId: string,
  ): Promise<Room> {
    this.logger.log(
      `Attempting to create room for host: ${hostId}`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity of room and room player creation.
    return await this.dataSource.transaction(async (manager) => {
      // Find the host user by ID using the transaction's EntityManager.
      const host = await manager.findOneBy(User, { id: hostId });
      if (!host) {
        this.logger.error(
          `Host with ID "${hostId}" not found during room creation.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Host with ID "${hostId}" not found.`);
      }

      // Create a new Room entity instance.
      // Default `isPublic` to true and `approvalRequired` to false if not provided.
      const newRoom = manager.create(Room, {
        ...createRoomDto,
        isPublic: createRoomDto.isPublic ?? true,
        approvalRequired: createRoomDto.approvalRequired ?? false,
        hostId: host.id, // Set the host ID.
        host: host, // Associate the host object.
      });
      // Save the new room to the database using the transaction's EntityManager.
      const savedRoom = await manager.save(Room, newRoom);
      this.logger.log(
        `Room created with ID: ${savedRoom.id} by host: ${hostId}`,
        'WaitingRoomService',
      );

      // Add the host as an active player in the room.
      const hostRoomPlayer = manager.create(RoomPlayer, {
        roomId: savedRoom.id,
        userId: host.id,
        status: RoomPlayerStatus.ACTIVE, // Host is always an active player.
      });
      // Save the host's room player entry using the transaction's EntityManager.
      await manager.save(RoomPlayer, hostRoomPlayer);
      this.logger.log(
        `Host ${hostId} added as active player to room ${savedRoom.id}`,
        'WaitingRoomService',
      );

      // Emit a WebSocket update to notify clients about the new room.
      this.waitingRoomGateway.emitRoomUpdate(savedRoom);
      // Return the room with populated relations (host and roomPlayers) for a complete response.
      return this.findRoomById(savedRoom.id);
    });
  }

  /**
   * Retrieves a paginated list of waiting rooms.
   * Filters rooms based on whether they are public or if the specified user is the host or an active player.
   * @param userId The ID of the current user (optional, for filtering).
   * @param page The page number to retrieve (defaults to 1).
   * @param limit The maximum number of rooms per page (defaults to 10).
   * @returns An object containing the array of Room entities and the total count of matching rooms.
   */
  async findAllRooms(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ rooms: Room[]; total: number }> {
    this.logger.log(
      `Fetching all rooms for user: ${userId || 'anonymous'} with page: ${page}, limit: ${limit}`,
      'WaitingRoomService',
    );
    // Create a query builder for the Room entity.
    const queryBuilder = this.roomRepository
      .createQueryBuilder('room')
      // Eagerly load related entities to avoid N+1 query problems.
      .leftJoinAndSelect('room.host', 'host') // Join with the host user.
      .leftJoinAndSelect('room.roomPlayers', 'roomPlayer') // Join with room players.
      .leftJoinAndSelect('roomPlayer.player', 'player'); // Join with the player details for each room player.

    // Apply filtering conditions based on whether a userId is provided.
    if (userId) {
      // If a user is authenticated, show public rooms, rooms hosted by the user,
      // or rooms where the user is an active player.
      queryBuilder
        .where('room.isPublic = :isPublicTrue', { isPublicTrue: true })
        .orWhere('room.hostId = :currentUserId', { currentUserId: userId })
        .orWhere(
          'roomPlayer.userId = :currentUserId AND roomPlayer.status = :activeStatus',
          {
            currentUserId: userId,
            activeStatus: RoomPlayerStatus.ACTIVE,
          },
        );
      this.logger.debug(
        `Querying for public rooms or rooms where user ${userId} is host/active player.`,
        'WaitingRoomService',
      );
    } else {
      // If no user is authenticated, only show public rooms.
      queryBuilder.where('room.isPublic = :isPublicTrue', {
        isPublicTrue: true,
      });
      this.logger.debug(
        'Querying for public rooms only (anonymous user).',
        'WaitingRoomService',
      );
    }

    // Apply pagination (skip and take) and execute the query to get rooms and their total count.
    const [rooms, total] = await queryBuilder
      .skip((page - 1) * limit) // Calculate the offset for pagination.
      .take(limit) // Limit the number of results per page.
      .getManyAndCount(); // Execute the query and get both results and total count.

    this.logger.log(
      `Found ${rooms.length} rooms (total: ${total}) for user: ${userId || 'anonymous'} on page ${page}.`,
      'WaitingRoomService',
    );
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
    this.logger.log(
      `Attempting to find room by ID: ${id}`,
      'WaitingRoomService',
    );
    const cacheKey = `room_${id}`; // Define a unique cache key for the room.
    let room = await this.cacheManager.get<Room>(cacheKey); // Attempt to retrieve the room from cache.

    if (room) {
      this.logger.log(
        `Room with ID: ${id} found in cache.`,
        'WaitingRoomService',
      );
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
    this.logger.log(
      `Room found with ID: ${id} and cached.`,
      'WaitingRoomService',
    );
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
  async updateRoom(
    id: string,
    updateRoomDto: UpdateRoomDto,
    hostId: string,
  ): Promise<Room> {
    this.logger.log(
      `Attempting to update room ${id} by host: ${hostId}`,
      'WaitingRoomService',
    );
    // Find the room by ID. This also handles NotFoundException.
    const room = await this.findRoomById(id);
    // Check if the authenticated user is the host of the room.
    if (room.hostId !== hostId) {
      this.logger.warn(
        `Forbidden: Host ${hostId} attempted to update room ${id} which they do not own.`,
        'WaitingRoomService',
      );
      throw new ForbiddenException('Only the host can update this room.');
    }
    // Apply updates from the DTO to the room entity.
    Object.assign(room, updateRoomDto);
    // Save the updated room to the database.
    const updatedRoom = await this.roomRepository.save(room);
    this.logger.log(
      `Room ${id} updated successfully by host: ${hostId}`,
      'WaitingRoomService',
    );
    // Emit a WebSocket update to notify clients about the room change.
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${id}`); // Invalidate the cache for this room.
    this.logger.log(
      `Cache for room ${id} invalidated due to update.`,
      'WaitingRoomService',
    );
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
  /**
   * Deletes a waiting room and all associated room players within a transaction.
   * Ensures atomicity of RoomPlayers and Room deletion.
   * @param roomId The ID of the room to delete.
   * @param hostId The ID of the user attempting to delete the room.
   * @returns A success message.
   * @throws NotFoundException if the room is not found or could not be deleted.
   * @throws ForbiddenException if the user is not the host of the room.
   * @throws Error if the transaction fails.
   */
  async deleteRoom(
    roomId: string,
    hostId: string,
  ): Promise<{ message: string }> {
    this.logger.log(
      `Attempting to delete room ${roomId} by host: ${hostId}`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity of room and room player deletion.
    return await this.dataSource.transaction(async (manager) => {
      // Find the room by ID using the transaction's EntityManager.
      const room = await manager.findOne(Room, { where: { id: roomId } });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found for deletion.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Check if the authenticated user is the host of the room.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`,
          'WaitingRoomService',
        );
        throw new ForbiddenException('Only the host can delete this room.');
      }

      // Delete all room player entries associated with this room using the transaction's EntityManager.
      await manager.delete(RoomPlayer, { roomId: roomId });
      // Delete the room from the database using the transaction's EntityManager.
      const deleteResult = await manager.delete(Room, roomId);

      // Check if any rows were affected by the delete operation.
      if (deleteResult.affected === 0) {
        this.logger.error(
          `Room with ID "${roomId}" could not be deleted or was already deleted.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(
          `Room with ID "${roomId}" could not be deleted or was already deleted.`,
        );
      }

      this.logger.log(
        `Room with ID "${roomId}" successfully deleted by host: ${hostId}`,
        'WaitingRoomService',
      );
      // Emit a WebSocket update to signify the room's deletion (e.g., by setting status to FINISHED).
      this.waitingRoomGateway.emitRoomUpdate({
        id: roomId,
        status: RoomStatus.FINISHED,
      } as Room);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to deletion.`,
        'WaitingRoomService',
      );
      return { message: `Room with ID "${roomId}" successfully deleted.` };
    });
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
  /**
   * Allows a user to join a waiting room within a transaction to prevent race conditions.
   * Handles various scenarios: user not found, host attempting to join as player,
   * existing player status (active, pending), room capacity, and approval requirements.
   * @param roomId The ID of the room to join.
   * @param userId The ID of the user attempting to join.
   * @returns The updated Room entity after the join operation.
   * @throws NotFoundException if the user is not found.
   * @throws BadRequestException for various invalid join scenarios (e.g., host joining, room full, already active/pending).
   * @throws Error if the transaction fails.
   */
  async joinRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(
      `Attempting to join room ${roomId} by user: ${userId}`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity and prevent race conditions during join operations.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details, including relations, and user details using the transaction's EntityManager.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        this.logger.error(
          `User with ID "${userId}" not found during join room operation.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`User with ID "${userId}" not found.`);
      }

      // Prevent the room host from joining as a regular player.
      if (room.hostId === userId) {
        this.logger.warn(
          `Host ${userId} attempted to join room ${roomId} as a player.`,
          'WaitingRoomService',
        );
        throw new BadRequestException(
          'Host is already part of the room and cannot join as a player.',
        );
      }

      // Check for an existing RoomPlayer entry for this user in this room.
      const existingPlayer = await manager.findOne(RoomPlayer, {
        where: { roomId, userId },
      });

      if (existingPlayer) {
        // If the user is already an active player, prevent re-joining.
        if (existingPlayer.status === RoomPlayerStatus.ACTIVE) {
          this.logger.warn(
            `User ${userId} is already an active player in room ${roomId}.`,
            'WaitingRoomService',
          );
          throw new BadRequestException('Player is already in this room.');
        }
        // If a join request is already pending, prevent duplicate requests.
        if (existingPlayer.status === RoomPlayerStatus.PENDING) {
          this.logger.warn(
            `Join request already pending for user ${userId} in room ${roomId}.`,
            'WaitingRoomService',
          );
          throw new BadRequestException(
            'Join request already pending for this room.',
          );
        }
        // If the user had a previous status (e.g., LEFT, DECLINED), remove the old entry to allow a fresh join.
        this.logger.log(
          `Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`,
          'WaitingRoomService',
        );
        await manager.remove(existingPlayer);
      }

      // Check if the room has reached its maximum player capacity.
      const activePlayersCount = await manager.count(RoomPlayer, {
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      if (activePlayersCount >= room.maxPlayers) {
        this.logger.warn(
          `Room ${roomId} is full. User ${userId} cannot join.`,
          'WaitingRoomService',
        );
        throw new BadRequestException('Room is full.');
      }

      // Determine the new player's status based on the room's approval requirements.
      let newPlayerStatus: RoomPlayerStatus;
      if (room.approvalRequired) {
        newPlayerStatus = RoomPlayerStatus.PENDING; // If approval is required, status is PENDING.
        this.logger.log(
          `User ${userId} join request for room ${roomId} set to PENDING (approval required).`,
          'WaitingRoomService',
        );
      } else {
        newPlayerStatus = RoomPlayerStatus.ACTIVE; // Otherwise, status is ACTIVE.
        this.logger.log(
          `User ${userId} joined room ${roomId} as ACTIVE (no approval required).`,
          'WaitingRoomService',
        );
      }

      // Create and save the new RoomPlayer entry.
      const roomPlayer = manager.create(RoomPlayer, {
        roomId: room.id,
        userId: user.id,
        status: newPlayerStatus,
      });
      await manager.save(RoomPlayer, roomPlayer);

      // Fetch the updated room with its new player list and emit a WebSocket update.
      const updatedRoom = await this.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to join.`,
        'WaitingRoomService',
      );
      return updatedRoom;
    });
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
  /**
   * Approves or declines a pending join request for a specific room within a transaction.
   * Ensures atomicity of player status updates and room capacity checks.
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
   * @throws Error if the transaction fails.
   */
  async approveOrDeclineJoinRequest(
    roomId: string,
    pendingUserId: string,
    decision: JoinRequestDecision,
    hostId: string,
  ): Promise<Room> {
    this.logger.log(
      `Host ${hostId} attempting to ${decision} join request for user ${pendingUserId} in room ${roomId}.`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity of approval/decline operations.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }
      this.logger.log(
        `[approveOrDeclineJoinRequest] Room found: ${room.id}, approvalRequired: ${room.approvalRequired}`,
        'WaitingRoomService',
      );

      // Ensure only the room host can approve/decline requests.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`,
          'WaitingRoomService',
        );
        throw new ForbiddenException(
          'Only the room host can approve or decline join requests.',
        );
      }

      // Ensure the room actually requires approval for join requests.
      if (!room.approvalRequired) {
        this.logger.warn(
          `Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`,
          'WaitingRoomService',
        );
        throw new BadRequestException(
          'This room does not require approval for join requests.',
        );
      }

      this.logger.log(
        `[approveOrDeclineJoinRequest] Checking for pending player: roomId=${roomId}, userId=${pendingUserId}`,
        'WaitingRoomService',
      );
      // Find the specific pending room player entry using the transaction's EntityManager.
      const pendingRoomPlayer = await manager.findOne(RoomPlayer, {
        where: {
          roomId,
          userId: pendingUserId,
          status: RoomPlayerStatus.PENDING, // Crucially, only target pending requests.
        },
      });

      if (!pendingRoomPlayer) {
        this.logger.warn(
          `Join request for user "${pendingUserId}" in room ${roomId} not found or already processed.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(
          `Join request for user "${pendingUserId}" not found or already processed.`,
        );
      }

      // Process the decision (APPROVE or DECLINE).
      if (decision === JoinRequestDecision.APPROVE) {
        // If approving, check if the room has capacity for another active player.
        const activePlayersCount = await manager.count(RoomPlayer, {
          where: { roomId, status: RoomPlayerStatus.ACTIVE },
        });

        if (activePlayersCount >= room.maxPlayers) {
          this.logger.warn(
            `Cannot approve join request for user ${pendingUserId} in room ${roomId}: Room is full.`,
            'WaitingRoomService',
          );
          throw new BadRequestException(
            'Cannot approve join request: Room is full.',
          );
        }
        // Change status to ACTIVE upon approval.
        pendingRoomPlayer.status = RoomPlayerStatus.ACTIVE;
        this.logger.log(
          `Join request for user ${pendingUserId} in room ${roomId} APPROVED.`,
          'WaitingRoomService',
        );
      } else {
        // Change status to DECLINED.
        pendingRoomPlayer.status = RoomPlayerStatus.DECLINED;
        this.logger.log(
          `Join request for user ${pendingUserId} in room ${roomId} DECLINED.`,
          'WaitingRoomService',
        );
      }

      // Save the updated RoomPlayer status using the transaction's EntityManager.
      await manager.save(RoomPlayer, pendingRoomPlayer);
      // Fetch the updated room and emit a WebSocket update.
      const updatedRoom = await this.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to approval/decline.`,
        'WaitingRoomService',
      );
      // Return the updated room, ensuring the latest state is reflected.
      return updatedRoom;
    });
  }

  /**
   * Allows a user to leave a waiting room within a transaction.
   * Ensures atomicity of player status updates.
   * Prevents the host from using this endpoint (hosts should delete the room instead).
   * Changes the player's status to 'LEFT'.
   * @param roomId The ID of the room to leave.
   * @param userId The ID of the user attempting to leave.
   * @returns The updated Room entity.
   * @throws NotFoundException if the room is not found.
   * @throws BadRequestException if the user is the host, not associated with the room, or has already left/declined.
   * @throws Error if the transaction fails.
   */
  async leaveRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(
      `User ${userId} attempting to leave room: ${roomId}`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity of player status updates.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Prevent the host from leaving the room as a player; they should delete the room.
      if (room.hostId === userId) {
        this.logger.warn(
          `Host ${userId} attempted to leave room ${roomId} using player leave endpoint.`,
          'WaitingRoomService',
        );
        throw new BadRequestException(
          'Host cannot leave the room using this endpoint. Hosts can delete their rooms.',
        );
      }

      // Find the RoomPlayer entry for the user in this room using the transaction's EntityManager.
      const roomPlayer = await manager.findOne(RoomPlayer, {
        where: { roomId, userId },
      });

      if (!roomPlayer) {
        this.logger.warn(
          `User ${userId} is not associated with room ${roomId}.`,
          'WaitingRoomService',
        );
        throw new BadRequestException('User is not associated with this room.');
      }

      // Only allow leaving if the player is currently ACTIVE or PENDING.
      if (
        roomPlayer.status === RoomPlayerStatus.ACTIVE ||
        roomPlayer.status === RoomPlayerStatus.PENDING
      ) {
        roomPlayer.status = RoomPlayerStatus.LEFT; // Set status to LEFT.
        await manager.save(RoomPlayer, roomPlayer); // Save the updated status using the transaction's EntityManager.
        this.logger.log(
          `User ${userId} successfully left room ${roomId}.`,
          'WaitingRoomService',
        );
      } else {
        // If the user is already LEFT or DECLINED, prevent redundant actions.
        this.logger.warn(
          `User ${userId} has already left or declined to join room ${roomId}.`,
          'WaitingRoomService',
        );
        throw new BadRequestException(
          'User has already left or declined to join this room.',
        );
      }

      // Fetch the updated room and emit a WebSocket update.
      const updatedRoom = await this.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to leave.`,
        'WaitingRoomService',
      );
      return updatedRoom;
    });
  }

  /**
   * Initiates the game for a specific room, changing its status to 'IN_PROGRESS' and declining pending requests within a transaction.
   * Ensures atomicity of Room status update and pending player decline.
   * @param roomId The ID of the room to start the game in.
   * @param hostId The ID of the user (host) attempting to start the game.
   * @returns The updated Room entity.
   * @throws NotFoundException if the room is not found.
   * @throws ForbiddenException if the user is not the room host.
   * @throws BadRequestException if the room is not in 'WAITING' status or has no active players.
   * @throws Error if the transaction fails.
   */
  async startGame(roomId: string, hostId: string): Promise<Room> {
    this.logger.log(
      `Host ${hostId} attempting to start game in room: ${roomId}`,
      'WaitingRoomService',
    );

    // Use a transaction to ensure atomicity of room status update and pending player decline.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'WaitingRoomService',
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Ensure only the room host can start the game.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to start game in room ${roomId} which they do not own.`,
          'WaitingRoomService',
        );
        throw new ForbiddenException('Only the host can start the game.');
      }

      // Ensure the room is in a 'WAITING' state before starting the game.
      if (room.status !== RoomStatus.WAITING) {
        this.logger.warn(
          `Game cannot be started in room ${roomId}. Current status: ${room.status}.`,
          'WaitingRoomService',
        );
        throw new BadRequestException(
          `Game cannot be started. Room status is currently '${room.status}'.`,
        );
      }

      // Check if there are any active players in the room.
      const activePlayersCount = await manager.count(RoomPlayer, {
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      // A game cannot start without any active players.
      if (activePlayersCount === 0) {
        this.logger.warn(
          `Cannot start game in room ${roomId}: No active players.`,
          'WaitingRoomService',
        );
        throw new BadRequestException('Cannot start a game with no players.');
      }

      // Update the room status to 'IN_PROGRESS'.
      room.status = RoomStatus.IN_PROGRESS;
      this.logger.log(
        `Game started in room ${roomId}. Status set to IN_PROGRESS.`,
        'WaitingRoomService',
      );

      // Decline all pending join requests for this room as the game is starting.
      await manager.update(
        RoomPlayer,
        { roomId, status: RoomPlayerStatus.PENDING },
        { status: RoomPlayerStatus.DECLINED },
      );
      this.logger.log(
        `All pending join requests for room ${roomId} declined.`,
        'WaitingRoomService',
      );

      // Save the updated room status.
      const updatedRoom = await manager.save(Room, room);
      // Emit a WebSocket update to notify clients about the game start.
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to game start.`,
        'WaitingRoomService',
      );
      return updatedRoom;
    });
  }
}
