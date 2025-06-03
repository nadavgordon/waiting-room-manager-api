import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { RoomPlayer } from './entities/room-player.entity';
import { User } from '../user/entities/user.entity';
import { RoomPlayerStatus } from './enums/room-player-status.enum';
import { JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { LoggerService } from '../common/logger/logger.service';
import { RoomQueryService } from './room-query.service'; // New dependency
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // For cache invalidation
import { Cache } from 'cache-manager'; // For cache invalidation
import { Inject } from '@nestjs/common'; // For CACHE_MANAGER

@Injectable()
export class RoomPlayerService {
  constructor(
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    // RoomRepository might not be directly needed if RoomQueryService handles fetching rooms
    private readonly waitingRoomGateway: WaitingRoomGateway,
    private readonly logger: LoggerService,
    private readonly roomQueryService: RoomQueryService, // Injected
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // For cache invalidation
  ) {}

  /**
   * Allows a user to join a waiting room within a transaction to prevent race conditions.
   * Handles various scenarios: user not found, host attempting to join as player,
   * existing player status (active, pending), room capacity, and approval requirements.
   * @param roomId The ID of the room to join.
   * @param userId The ID of the user attempting to join.
   * @returns The updated Room entity after the join operation.
   * @throws NotFoundException if the user or room is not found.
   * @throws BadRequestException for various invalid join scenarios (e.g., host joining, room full, already active/pending).
   * @throws Error if the transaction fails.
   */
  async joinRoom(roomId: string, userId: string): Promise<Room> {
    this.logger.log(
      `Attempting to join room ${roomId} by user: ${userId}`,
      'RoomPlayerService', // Updated context
    );

    // Use a transaction to ensure atomicity and prevent race conditions during join operations.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details, including relations, using RoomQueryService.
      // We pass the transaction manager to roomQueryService.findRoomById
      // to ensure the read is part of the same transaction.
      // However, roomQueryService.findRoomById uses cache, which is not ideal within a transaction
      // for write-heavy operations. For joinRoom, we need the freshest room data.
      // So, we fetch directly using the transaction's EntityManager.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'RoomPlayerService', // Updated context
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      const user = await manager.findOneBy(User, { id: userId });
      if (!user) {
        this.logger.error(
          `User with ID "${userId}" not found during join room operation.`,
          'RoomPlayerService', // Updated context
        );
        throw new NotFoundException(`User with ID "${userId}" not found.`);
      }

      // Prevent the room host from joining as a regular player.
      if (room.hostId === userId) {
        this.logger.warn(
          `Host ${userId} attempted to join room ${roomId} as a player.`,
          'RoomPlayerService', // Updated context
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
            'RoomPlayerService', // Updated context
          );
          throw new BadRequestException('Player is already in this room.');
        }
        // If a join request is already pending, prevent duplicate requests.
        if (existingPlayer.status === RoomPlayerStatus.PENDING) {
          this.logger.warn(
            `Join request already pending for user ${userId} in room ${roomId}.`,
            'RoomPlayerService', // Updated context
          );
          throw new BadRequestException(
            'Join request already pending for this room.',
          );
        }
        // If the user had a previous status (e.g., LEFT, DECLINED), remove the old entry to allow a fresh join.
        this.logger.log(
          `Removing old room player entry for user ${userId} in room ${roomId} (status: ${existingPlayer.status}).`,
          'RoomPlayerService', // Updated context
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
          'RoomPlayerService', // Updated context
        );
        throw new BadRequestException('Room is full.');
      }

      // Determine the new player's status based on the room's approval requirements.
      let newPlayerStatus: RoomPlayerStatus;
      if (room.approvalRequired) {
        newPlayerStatus = RoomPlayerStatus.PENDING; // If approval is required, status is PENDING.
        this.logger.log(
          `User ${userId} join request for room ${roomId} set to PENDING (approval required).`,
          'RoomPlayerService', // Updated context
        );
      } else {
        newPlayerStatus = RoomPlayerStatus.ACTIVE; // Otherwise, status is ACTIVE.
        this.logger.log(
          `User ${userId} joined room ${roomId} as ACTIVE (no approval required).`,
          'RoomPlayerService', // Updated context
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
      // Use RoomQueryService to get the full room details for the event.
      const updatedRoom = await this.roomQueryService.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to join.`,
        'RoomPlayerService', // Updated context
      );
      return updatedRoom;
    });
  }

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
   * @throws NotFoundException if the pending join request or room is not found.
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
      'RoomPlayerService', // Updated context
    );

    // Use a transaction to ensure atomicity of approval/decline operations.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager for freshness.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });
      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'RoomPlayerService', // Updated context
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }
      this.logger.log(
        `[approveOrDeclineJoinRequest] Room found: ${room.id}, approvalRequired: ${room.approvalRequired}`,
        'RoomPlayerService', // Updated context
      );

      // Ensure only the room host can approve/decline requests.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to approve/decline request in room ${roomId} which they do not own.`,
          'RoomPlayerService', // Updated context
        );
        throw new ForbiddenException(
          'Only the room host can approve or decline join requests.',
        );
      }

      // Ensure the room actually requires approval for join requests.
      if (!room.approvalRequired) {
        this.logger.warn(
          `Room ${roomId} does not require approval, but host ${hostId} attempted to approve/decline.`,
          'RoomPlayerService', // Updated context
        );
        throw new BadRequestException(
          'This room does not require approval for join requests.',
        );
      }

      this.logger.log(
        `[approveOrDeclineJoinRequest] Checking for pending player: roomId=${roomId}, userId=${pendingUserId}`,
        'RoomPlayerService', // Updated context
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
          'RoomPlayerService', // Updated context
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
            'RoomPlayerService', // Updated context
          );
          throw new BadRequestException(
            'Cannot approve join request: Room is full.',
          );
        }
        // Change status to ACTIVE upon approval.
        pendingRoomPlayer.status = RoomPlayerStatus.ACTIVE;
        this.logger.log(
          `Join request for user ${pendingUserId} in room ${roomId} APPROVED.`,
          'RoomPlayerService', // Updated context
        );
      } else {
        // Change status to DECLINED.
        pendingRoomPlayer.status = RoomPlayerStatus.DECLINED;
        this.logger.log(
          `Join request for user ${pendingUserId} in room ${roomId} DECLINED.`,
          'RoomPlayerService', // Updated context
        );
      }

      // Save the updated RoomPlayer status using the transaction's EntityManager.
      await manager.save(RoomPlayer, pendingRoomPlayer);
      // Fetch the updated room using RoomQueryService and emit a WebSocket update.
      const updatedRoom = await this.roomQueryService.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to approval/decline.`,
        'RoomPlayerService', // Updated context
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
      'RoomPlayerService', // Updated context
    );

    // Use a transaction to ensure atomicity of player status updates.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager for freshness.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'RoomPlayerService', // Updated context
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Prevent the host from leaving the room as a player; they should delete the room.
      if (room.hostId === userId) {
        this.logger.warn(
          `Host ${userId} attempted to leave room ${roomId} using player leave endpoint.`,
          'RoomPlayerService', // Updated context
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
          'RoomPlayerService', // Updated context
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
          'RoomPlayerService', // Updated context
        );
      } else {
        // If the user is already LEFT or DECLINED, prevent redundant actions.
        this.logger.warn(
          `User ${userId} has already left or declined to join room ${roomId}.`,
          'RoomPlayerService', // Updated context
        );
        throw new BadRequestException(
          'User has already left or declined to join this room.',
        );
      }

      // Fetch the updated room using RoomQueryService and emit a WebSocket update.
      const updatedRoom = await this.roomQueryService.findRoomById(roomId);
      this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to leave.`,
        'RoomPlayerService', // Updated context
      );
      return updatedRoom;
    });
  }
}
