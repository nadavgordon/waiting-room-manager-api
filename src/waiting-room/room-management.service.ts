import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';
import { RoomPlayer } from './entities/room-player.entity';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { User } from '../user/entities/user.entity';
import { RoomPlayerStatus } from './enums/room-player-status.enum';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { LoggerService } from '../common/logger/logger.service';
import { RoomQueryService } from './room-query.service'; // New dependency
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // For cache invalidation
import { Cache } from 'cache-manager'; // For cache invalidation
import { Inject } from '@nestjs/common'; // For CACHE_MANAGER

@Injectable()
export class RoomManagementService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    @InjectRepository(RoomPlayer)
    private readonly roomPlayerRepository: Repository<RoomPlayer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly waitingRoomGateway: WaitingRoomGateway,
    private readonly logger: LoggerService,
    private readonly roomQueryService: RoomQueryService, // Injected
    private dataSource: DataSource,
    @Inject(CACHE_MANAGER) private cacheManager: Cache, // For cache invalidation
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
      'RoomManagementService', // Updated context
    );

    // Use a transaction to ensure atomicity of room and room player creation.
    return await this.dataSource.transaction(async (manager) => {
      // Find the host user by ID using the transaction's EntityManager.
      const host = await manager.findOneBy(User, { id: hostId });
      if (!host) {
        this.logger.error(
          `Host with ID "${hostId}" not found during room creation.`,
          'RoomManagementService', // Updated context
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
        'RoomManagementService', // Updated context
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
        'RoomManagementService', // Updated context
      );

      // Emit a WebSocket update to notify clients about the new room.
      this.waitingRoomGateway.emitRoomUpdate(savedRoom);
      // Return the room with populated relations (host and roomPlayers) for a complete response.
      // Uses RoomQueryService now
      return this.roomQueryService.findRoomById(savedRoom.id);
    });
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
      'RoomManagementService', // Updated context
    );
    // Find the room by ID using RoomQueryService. This also handles NotFoundException.
    const room = await this.roomQueryService.findRoomById(id);
    // Check if the authenticated user is the host of the room.
    if (room.hostId !== hostId) {
      this.logger.warn(
        `Forbidden: Host ${hostId} attempted to update room ${id} which they do not own.`,
        'RoomManagementService', // Updated context
      );
      throw new ForbiddenException('Only the host can update this room.');
    }
    // Apply updates from the DTO to the room entity.
    Object.assign(room, updateRoomDto);
    // Save the updated room to the database.
    const updatedRoom = await this.roomRepository.save(room);
    this.logger.log(
      `Room ${id} updated successfully by host: ${hostId}`,
      'RoomManagementService', // Updated context
    );
    // Emit a WebSocket update to notify clients about the room change.
    this.waitingRoomGateway.emitRoomUpdate(updatedRoom);
    await this.cacheManager.del(`room_${id}`); // Invalidate the cache for this room.
    this.logger.log(
      `Cache for room ${id} invalidated due to update.`,
      'RoomManagementService', // Updated context
    );
    return updatedRoom;
  }

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
      'RoomManagementService', // Updated context
    );

    // Use a transaction to ensure atomicity of room and room player deletion.
    return await this.dataSource.transaction(async (manager) => {
      // Find the room by ID using the transaction's EntityManager.
      // We don't use roomQueryService.findRoomById here because that would fetch from cache,
      // and for a delete operation, we need the freshest data from the DB within the transaction.
      const room = await manager.findOne(Room, { where: { id: roomId } });

      if (!room) {
        this.logger.warn(
          `Room with ID "${roomId}" not found for deletion.`,
          'RoomManagementService', // Updated context
        );
        throw new NotFoundException(`Room with ID "${roomId}" not found`);
      }

      // Check if the authenticated user is the host of the room.
      if (room.hostId !== hostId) {
        this.logger.warn(
          `Forbidden: Host ${hostId} attempted to delete room ${roomId} which they do not own.`,
          'RoomManagementService', // Updated context
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
          'RoomManagementService', // Updated context
        );
        throw new NotFoundException(
          `Room with ID "${roomId}" could not be deleted or was already deleted.`,
        );
      }

      this.logger.log(
        `Room with ID "${roomId}" successfully deleted by host: ${hostId}`,
        'RoomManagementService', // Updated context
      );
      // Emit a WebSocket update to signify the room's deletion (e.g., by setting status to FINISHED).
      this.waitingRoomGateway.emitRoomUpdate({
        id: roomId,
        status: RoomStatus.FINISHED,
      } as Room);
      await this.cacheManager.del(`room_${roomId}`); // Invalidate the cache for this room.
      this.logger.log(
        `Cache for room ${roomId} invalidated due to deletion.`,
        'RoomManagementService', // Updated context
      );
      return { message: `Room with ID "${roomId}" successfully deleted.` };
    });
  }
}
