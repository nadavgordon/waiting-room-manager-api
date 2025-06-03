import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { LoggerService } from '../common/logger/logger.service';
import { RoomPlayerStatus } from './enums/room-player-status.enum';

@Injectable()
export class RoomQueryService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
    private readonly logger: LoggerService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

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
      'RoomQueryService', // Updated context
    );
    const cacheKey = `room_${id}`; // Define a unique cache key for the room.
    let room = await this.cacheManager.get<Room>(cacheKey); // Attempt to retrieve the room from cache.

    if (room) {
      this.logger.log(
        `Room with ID: ${id} found in cache.`,
        'RoomQueryService', // Updated context
      );
      return room; // Return cached room if available.
    }

    // If not in cache, fetch the room from the database with its related entities.
    room = await this.roomRepository.findOne({
      where: { id }, // Find by room ID.
      relations: ['host', 'roomPlayers', 'roomPlayers.player'], // Eagerly load host, room players, and their associated player details.
    });
    if (!room) {
      this.logger.warn(`Room with ID "${id}" not found.`, 'RoomQueryService'); // Updated context
      throw new NotFoundException(`Room with ID "${id}" not found`); // Throw if room is not found in DB.
    }
    // Cache the retrieved room for future requests.
    await this.cacheManager.set(cacheKey, room);
    this.logger.log(
      `Room found with ID: ${id} and cached.`,
      'RoomQueryService', // Updated context
    );
    return room;
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
      'RoomQueryService', // Updated context
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
            activeStatus: RoomPlayerStatus.ACTIVE, // Using the enum directly
          },
        );
      this.logger.debug(
        `Querying for public rooms or rooms where user ${userId} is host/active player.`,
        'RoomQueryService', // Updated context
      );
    } else {
      // If no user is authenticated, only show public rooms.
      queryBuilder.where('room.isPublic = :isPublicTrue', {
        isPublicTrue: true,
      });
      this.logger.debug(
        'Querying for public rooms only (anonymous user).',
        'RoomQueryService', // Updated context
      );
    }

    // Apply pagination (skip and take) and execute the query to get rooms and their total count.
    const [rooms, total] = await queryBuilder
      .skip((page - 1) * limit) // Calculate the offset for pagination.
      .take(limit) // Limit the number of results per page.
      .getManyAndCount(); // Execute the query and get both results and total count.

    this.logger.log(
      `Found ${rooms.length} rooms (total: ${total}) for user: ${userId || 'anonymous'} on page ${page}.`,
      'RoomQueryService', // Updated context
    );
    return { rooms, total };
  }
}
