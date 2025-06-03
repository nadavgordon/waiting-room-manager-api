import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomPlayer } from './entities/room-player.entity';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { LoggerService } from '../common/logger/logger.service';
import { RoomQueryService } from './room-query.service'; // New dependency
import { RoomPlayerStatus } from './enums/room-player-status.enum';
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // For cache invalidation
import { Cache } from 'cache-manager'; // For cache invalidation
import { Inject } from '@nestjs/common'; // For CACHE_MANAGER

@Injectable()
export class GameOrchestrationService {
  constructor(
    @InjectRepository(Room) // May not be needed if RoomQueryService is used
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    private readonly waitingRoomGateway: WaitingRoomGateway,
    private readonly logger: LoggerService,
    private readonly roomQueryService: RoomQueryService, // Injected
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // For cache invalidation
  ) {}

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
      'GameOrchestrationService', // Updated context
    );

    // Use a transaction to ensure atomicity of room status update and pending player decline.
    return await this.dataSource.transaction(async (manager) => {
      // Retrieve room details using the transaction's EntityManager for freshness.
      const room = await manager.findOne(Room, {
        where: { id: roomId },
        relations: ['host', 'roomPlayers', 'roomPlayers.player'],
      });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found.`,
          'GameOrchestrationService', // Updated context
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Ensure only the room host can start the game.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to start game in room ${roomId} which they do not own.`,
          'GameOrchestrationService', // Updated context
        );
        throw new ForbiddenException('Only the host can start the game.');
      }

      // Ensure the room is in a 'WAITING' state before starting the game.
      if (room.status !== RoomStatus.WAITING) {
        this.logger.warn(
          `Game cannot be started in room ${roomId}. Current status: ${room.status}.`,
          'GameOrchestrationService', // Updated context
        );
        throw new BadRequestException(
          `Game cannot be started. Room status is currently '${room.status}'.`,
        );
      }

      // Check if there are any active players in the room.
      // Note: The original code counts RoomPlayer entities directly.
      // If room.roomPlayers is reliably populated by the 'relations' in findOne,
      // we could potentially use room.roomPlayers.filter(p => p.status === RoomPlayerStatus.ACTIVE).length
      // However, counting directly via manager.count is safer against stale relation data.
      const activePlayersCount = await manager.count(RoomPlayer, {
        where: { roomId, status: RoomPlayerStatus.ACTIVE },
      });

      // A game cannot start without any active players.
      // The host is an active player, so this also implies the host must be present.
      if (activePlayersCount === 0) {
        this.logger.warn(
          `Cannot start game in room ${roomId}: No active players.`,
          'GameOrchestrationService', // Updated context
        );
        throw new BadRequestException('Cannot start a game with no players.');
      }

      // Update the room status to 'IN_PROGRESS'.
      room.status = RoomStatus.IN_PROGRESS;
      this.logger.log(
        `Game started in room ${roomId}. Status set to IN_PROGRESS.`,
        'GameOrchestrationService', // Updated context
      );

      // Decline all pending join requests for this room as the game is starting.
      await manager.update(
        RoomPlayer,
        { roomId, status: RoomPlayerStatus.PENDING },
        { status: RoomPlayerStatus.DECLINED },
      );
      this.logger.log(
        `All pending join requests for room ${roomId} declined.`,
        'GameOrchestrationService', // Updated context
      );

      // Save the updated room status.
      const updatedRoomEntity = await manager.save(Room, room); // Renamed to avoid conflict
      // Emit a WebSocket update to notify clients about the game start.
      // Use RoomQueryService to get full details for the event.
      const fullUpdatedRoom = await this.roomQueryService.findRoomById(
        updatedRoomEntity.id,
      );
      this.waitingRoomGateway.emitRoomUpdate(fullUpdatedRoom);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to game start.`,
        'GameOrchestrationService', // Updated context
      );
      return fullUpdatedRoom; // Return the fully populated room
    });
  }
}
