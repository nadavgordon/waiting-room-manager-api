import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus, Query, UseGuards, Request } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RespondToJoinRequestDto, JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { Room } from './entities/room.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth, ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { PaginationDto, PaginatedResponseDto } from '../common/dto/pagination.dto';

@ApiTags('WaitingRoom')
@ApiExtraModels(PaginatedResponseDto, Room)
@Controller('rooms')
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new waiting room' })
  @ApiBody({ type: CreateRoomDto, description: 'Details for creating a new room' })
  @ApiResponse({
    status: 201,
    description: 'The room has been successfully created.',
    type: Room,
  })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  async create(@Body() createRoomDto: CreateRoomDto, @GetUser('userId') hostId: string): Promise<Room> {
    return this.waitingRoomService.createRoom(createRoomDto, hostId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get all waiting rooms with pagination. Filters by public/private and host association if userId is provided.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10, max: 100)', example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved paginated rooms.',
    schema: {
      allOf: [
        { $ref: getSchemaPath(PaginatedResponseDto) },
        {
          properties: {
            data: {
              type: 'array',
              items: { $ref: getSchemaPath(Room) },
            },
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
        total: 1,
        limit: 10,
        page: 1,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  async findAll(
    @GetUser('userId') userId: string,
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Room>> {
    const { page = 1, limit = 10 } = paginationDto; // Provide default values
    const { rooms, total } = await this.waitingRoomService.findAllRooms(userId, page, limit);
    return new PaginatedResponseDto(rooms, total, limit, page);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific waiting room by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the room to retrieve', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved the room.', type: Room })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return this.waitingRoomService.findRoomById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a specific waiting room by ID' })
  @ApiParam({ name: 'id', description: 'The ID of the room to update', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiBody({ type: UpdateRoomDto, description: 'Fields to update for the room' })
  @ApiResponse({ status: 200, description: 'The room has been successfully updated.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Only the host can update the room.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.waitingRoomService.updateRoom(id, updateRoomDto, hostId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'The ID of the room to delete', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'Room successfully deleted.', schema: { example: { message: 'Room with ID a1b2c3d4-e5f6-7890-1234-567890abcdef successfully deleted.' } } })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Only the host can delete the room.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  remove(@Param('id') id: string, @GetUser('userId') hostId: string): Promise<{ message: string }> {
    return this.waitingRoomService.deleteRoom(id, hostId);
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Join a specific waiting room' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to join', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'User successfully joined the room or request is pending.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room full, player already in room, host joining as player, invalid user ID).' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  async joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.waitingRoomService.joinRoom(roomId, userId);
  }

  @Post(':roomId/pending-requests/:pendingUserId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Respond to a join request for a room (approve/decline)' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiParam({ name: 'pendingUserId', description: 'The ID of the user whose request is being responded to', type: 'string', format: 'uuid', example: 'b1c2d3e4-f5a6-7890-1234-567890abcdef' })
  @ApiBody({ type: RespondToJoinRequestDto, description: 'Decision to approve or decline the join request' })
  @ApiResponse({ status: 200, description: 'Join request successfully processed.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., request not found, room full, room does not require approval).' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can respond).' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.CREATED)
  async respondToJoinRequest(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('pendingUserId', ParseUUIDPipe) pendingUserId: string,
    @Body() respondToJoinRequestDto: RespondToJoinRequestDto,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.waitingRoomService.approveOrDeclineJoinRequest(
      roomId,
      pendingUserId,
      respondToJoinRequestDto.decision,
      hostId,
    );
  }

  @Post(':roomId/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Leave a room or cancel a pending join request' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to leave', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'Successfully left the room or cancelled request.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., user not in room, host attempting to leave)' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.OK)
  leaveRoom(
    @Param('roomId') roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.waitingRoomService.leaveRoom(roomId, userId);
  }

  @Post(':roomId/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Start the game in a room' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to start', type: 'string', format: 'uuid', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @ApiResponse({ status: 200, description: 'Game started successfully.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room not waiting, no players)' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Missing or invalid JWT token.' })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can start)' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  @HttpCode(HttpStatus.CREATED)
  startGame(
    @Param('roomId') roomId: string,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.waitingRoomService.startGame(roomId, hostId);
  }
}
