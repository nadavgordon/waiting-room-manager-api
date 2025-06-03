import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
// import { WaitingRoomService } from './waiting-room.service'; // Old service
import { RoomQueryService } from './room-query.service';
import { RoomManagementService } from './room-management.service';
import { RoomPlayerService } from './room-player.service';
import { GameOrchestrationService } from './game-orchestration.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RespondToJoinRequestDto } from './dto/respond-to-join-request.dto';
import { Room } from './entities/room.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../common/dto/pagination.dto';
import { ThrottlerBehindProxyGuard } from '../common/guards/throttler-behind-proxy.guard';
import { Throttle } from '@nestjs/throttler';

@ApiTags('WaitingRoom')
@ApiExtraModels(PaginatedResponseDto, Room) // Registers DTOs for Swagger schema generation.
@Controller('rooms')
export class WaitingRoomController {
  constructor(
    // private readonly waitingRoomService: WaitingRoomService, // Old service
    private readonly roomQueryService: RoomQueryService,
    private readonly roomManagementService: RoomManagementService,
    private readonly roomPlayerService: RoomPlayerService,
    private readonly gameOrchestrationService: GameOrchestrationService,
  ) {}

  /**
   * Creates a new waiting room.
   * This endpoint is protected by JWT authentication, ensuring only authenticated users can create rooms.
   * The host of the room is automatically set to the authenticated user.
   */
  @Post()
  @UseGuards(JwtAuthGuard, ThrottlerBehindProxyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for creating rooms
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new waiting room' })
  @ApiBody({
    type: CreateRoomDto,
    description: 'Details for creating a new room',
  })
  @ApiResponse({
    status: 201,
    description: 'The room has been successfully created.',
    type: Room,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  async create(
    @Body() createRoomDto: CreateRoomDto,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.roomManagementService.createRoom(createRoomDto, hostId);
  }

  /**
   * Retrieves a paginated list of waiting rooms.
   * This endpoint supports filtering based on room visibility (public/private) and
   * whether the authenticated user is the host or an active player in a room.
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get all waiting rooms with pagination. Filters by public/private and host association if userId is provided.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved paginated rooms.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: { type: 'array', items: { $ref: getSchemaPath(Room) } },
            totalItems: { type: 'number', example: 1 },
            itemsPerPage: { type: 'number', example: 10 },
            currentPage: { type: 'number', example: 1 },
            totalPages: { type: 'number', example: 1 },
          },
        },
      ],
      example: {
        data: [
          {
            id: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
            name: 'Public Game Room',
            isPublic: true,
            approvalRequired: false,
            maxPlayers: 10,
            status: 'waiting',
            hostId: 'b1c2d3e4-f5a6-7890-1234-567890abcdef',
            createdAt: '2023-01-01T12:00:00Z',
            updatedAt: '2023-01-01T12:00:00Z',
          },
        ],
        totalItems: 1,
        itemsPerPage: 10,
        currentPage: 1,
        itemCount: 1,
        totalPages: 1,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Room>> {
    const { page = 1, limit = 10 } = paginationDto;
    const { rooms, total } = await this.roomQueryService.findAllRooms(
      userId,
      page,
      limit,
    );
    return new PaginatedResponseDto(rooms, total, limit, page);
  }

  /**
   * Retrieves details of a specific waiting room by its ID.
   * This endpoint allows any authenticated user to view room details.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific waiting room by ID' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the room to retrieve',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved the room.',
    type: Room,
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return this.roomQueryService.findRoomById(id);
  }

  /**
   * Updates specific fields of an existing waiting room.
   * Only the room's host is authorized to perform this operation.
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a specific waiting room by ID' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the room to update',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiBody({
    type: UpdateRoomDto,
    description: 'Fields to update for the room',
  })
  @ApiResponse({
    status: 200,
    description: 'The room has been successfully updated.',
    type: Room,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the host can update the room.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.roomManagementService.updateRoom(id, updateRoomDto, hostId);
  }

  /**
   * Deletes a waiting room.
   * This operation is restricted to the room's host.
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({
    name: 'id',
    description: 'The ID of the room to delete',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Room successfully deleted.',
    schema: {
      example: {
        message:
          'Room with ID a1b2c3d4-e5f6-7890-1234-567890abcdef successfully deleted.',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden. Only the host can delete the room.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  remove(
    @Param('id') id: string,
    @GetUser('userId') hostId: string,
  ): Promise<{ message: string }> {
    return this.roomManagementService.deleteRoom(id, hostId);
  }

  /**
   * Allows an authenticated user to join a specific waiting room.
   * If the room has `approvalRequired` set to true, the user's status will be `PENDING`.
   * Otherwise, the user will directly become an `ACTIVE` player.
   */
  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard, ThrottlerBehindProxyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for joining rooms
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Join a specific waiting room' })
  @ApiParam({
    name: 'roomId',
    description: 'The ID of the room to join',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully joined the room or request is pending.',
    type: Room,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., room full, player already in room, host joining as player, invalid user ID).',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.roomPlayerService.joinRoom(roomId, userId);
  }

  /**
   * Allows the room host to approve or decline a pending join request from another user.
   * This endpoint is critical for managing access to private or approval-required rooms.
   */
  @Post(':roomId/pending-requests/:pendingUserId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Respond to a join request for a room (approve/decline)',
  })
  @ApiParam({
    name: 'roomId',
    description: 'The ID of the room',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiParam({
    name: 'pendingUserId',
    description: 'The ID of the user whose request is being responded to',
    type: 'string',
    format: 'uuid',
    example: 'b1c2d3e4-f5a6-7890-1234-567890abcdef',
  })
  @ApiBody({
    type: RespondToJoinRequestDto,
    description: 'Decision to approve or decline the join request',
  })
  @ApiResponse({
    status: 200,
    description: 'Join request successfully processed.',
    type: Room,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., request not found, room full, room does not require approval).',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (only host can respond).',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  async respondToJoinRequest(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('pendingUserId', ParseUUIDPipe) pendingUserId: string,
    @Body() respondToJoinRequestDto: RespondToJoinRequestDto,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.roomPlayerService.approveOrDeclineJoinRequest(
      roomId,
      pendingUserId,
      respondToJoinRequestDto.decision,
      hostId,
    );
  }

  /**
   * Allows an authenticated user to leave a room or cancel a pending join request.
   * This endpoint handles the user's departure from a room, updating their status accordingly.
   */
  @Post(':roomId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Leave a room or cancel a pending join request' })
  @ApiParam({
    name: 'roomId',
    description: 'The ID of the room to leave',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully left the room or cancelled request.',
    type: Room,
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad Request (e.g., user not in room, host attempting to leave)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  leaveRoom(
    @Param('roomId') roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.roomPlayerService.leaveRoom(roomId, userId);
  }

  /**
   * Allows the room host to start the game in a room.
   * This action transitions the room's status from `WAITING` to `IN_PROGRESS`
   * and automatically declines any remaining pending join requests.
   */
  @Post(':roomId/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start the game in a room' })
  @ApiParam({
    name: 'roomId',
    description: 'The ID of the room to start',
    type: 'string',
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @ApiResponse({
    status: 200,
    description: 'Game started successfully.',
    type: Room,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request (e.g., room not waiting, no players)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized. Missing or invalid JWT token.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can start)' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  startGame(
    @Param('roomId') roomId: string,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.gameOrchestrationService.startGame(roomId, hostId);
  }
}
