import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus, Query, UseGuards, Request } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { RespondToJoinRequestDto, JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { Room } from './entities/room.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';

@ApiTags('rooms') 
@Controller('rooms') 
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new waiting room' })
  @ApiResponse({ status: 201, description: 'The room has been successfully created.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  async create(@Body() createRoomDto: CreateRoomDto, @GetUser('userId') hostId: string): Promise<Room> {
    return this.waitingRoomService.createRoom(createRoomDto, hostId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all waiting rooms. Filters by public/private and host association if userId is provided.' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved rooms.', type: [Room] })
  async findAll(@GetUser('userId') userId?: string): Promise<Room[]> {
    return this.waitingRoomService.findAllRooms(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific waiting room by ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved the room.', type: Room })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return this.waitingRoomService.findRoomById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a specific waiting room by ID' })
  @ApiResponse({ status: 200, description: 'The room has been successfully updated.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'The ID of the room to delete', type: 'string' })
  @ApiResponse({ status: 200, description: 'Room successfully deleted.', schema: { example: { message: 'Room with ID ... successfully deleted.'}} })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can delete)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  remove(@Param('id') id: string, @GetUser('userId') hostId: string): Promise<{ message: string }> {
    return this.waitingRoomService.deleteRoom(id, hostId);
  }

  @Post(':roomId/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a specific waiting room' })
  @ApiResponse({ status: 200, description: 'User successfully joined the room or request is pending.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room full, player already in room, host joining as player, invalid user ID).' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.waitingRoomService.joinRoom(roomId, userId);
  }

  @Post(':roomId/pending-requests/:pendingUserId/respond')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Respond to a join request for a room (approve/decline)' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'pendingUserId', description: 'The ID of the user whose request is being responded to', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Join request successfully processed.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., request not found, room full, room does not require approval).' })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can respond).' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
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
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a room or cancel a pending join request' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to leave', type: 'string' })
  @ApiResponse({ status: 200, description: 'Successfully left the room or cancelled request.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., user not in room, host attempting to leave)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  leaveRoom(
    @Param('roomId') roomId: string,
    @GetUser('userId') userId: string,
  ): Promise<Room> {
    return this.waitingRoomService.leaveRoom(roomId, userId);
  }

  @Post(':roomId/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start the game in a room' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to start', type: 'string' })
  @ApiResponse({ status: 200, description: 'Game started successfully.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room not waiting, no players)' })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can start)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  startGame(
    @Param('roomId') roomId: string,
    @GetUser('userId') hostId: string,
  ): Promise<Room> {
    return this.waitingRoomService.startGame(roomId, hostId);
  }
}
