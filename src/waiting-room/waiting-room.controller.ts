import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { RespondToJoinRequestDto, JoinRequestDecision } from './dto/respond-to-join-request.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';
import { StartGameDto } from './dto/start-game.dto';
import { DeleteRoomDto } from './dto/delete-room.dto';
import { Room } from './entities/room.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';

@ApiTags('rooms') 
@Controller('rooms') 
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new waiting room' })
  @ApiResponse({ status: 201, description: 'The room has been successfully created.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  async create(@Body() createRoomDto: CreateRoomDto): Promise<Room> {
    return this.waitingRoomService.createRoom(createRoomDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all waiting rooms. Filters by public/private and host association if userId is provided.' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved rooms.', type: [Room] })
  @ApiQuery({ name: 'userId', required: false, description: 'Optional user ID to filter rooms for. If provided, private rooms hosted by the user are also shown.', type: String})
  async findAll(@Query('userId') userId?: string): Promise<Room[]> {
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
  @ApiOperation({ summary: 'Update a specific waiting room by ID' })
  @ApiResponse({ status: 200, description: 'The room has been successfully updated.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request. Invalid input data.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ): Promise<Room> {
    return this.waitingRoomService.updateRoom(id, updateRoomDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a room' })
  @ApiParam({ name: 'id', description: 'The ID of the room to delete', type: 'string' })
  @ApiBody({ type: DeleteRoomDto, description: 'Requires hostId for authorization' }) 
  @ApiResponse({ status: 200, description: 'Room successfully deleted.', schema: { example: { message: 'Room with ID ... successfully deleted.'}} })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can delete)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  remove(@Param('id') id: string, @Body() deleteRoomDto: DeleteRoomDto): Promise<{ message: string }> {
    return this.waitingRoomService.deleteRoom(id, deleteRoomDto.hostId);
  }

  @Post(':roomId/join')
  @ApiOperation({ summary: 'Join a specific waiting room' })
  @ApiResponse({ status: 200, description: 'User successfully joined the room or request is pending.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room full, player already in room, host joining as player, invalid user ID).' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async joinRoom(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body() joinRoomDto: JoinRoomDto,
  ): Promise<Room> {
    return this.waitingRoomService.joinRoom(roomId, joinRoomDto.userId);
  }

  @Post(':roomId/pending-requests/:pendingUserId/respond')
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
  ): Promise<Room> {
    // In a real app, hostUserId would come from an auth guard/decorator (e.g., @User('id') userId: string)
    return this.waitingRoomService.approveOrDeclineJoinRequest(
      roomId,
      pendingUserId,
      respondToJoinRequestDto.decision,
      respondToJoinRequestDto.hostUserId, // Using the temporary hostUserId from DTO
    );
  }

  @Post(':roomId/leave')
  @ApiOperation({ summary: 'Leave a room or cancel a pending join request' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to leave', type: 'string' })
  @ApiBody({ type: LeaveRoomDto })
  @ApiResponse({ status: 200, description: 'Successfully left the room or cancelled request.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., user not in room, host attempting to leave)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  leaveRoom(
    @Param('roomId') roomId: string,
    @Body() leaveRoomDto: LeaveRoomDto,
  ): Promise<Room> {
    return this.waitingRoomService.leaveRoom(roomId, leaveRoomDto.userId);
  }

  @Post(':roomId/start')
  @ApiOperation({ summary: 'Start the game in a room' })
  @ApiParam({ name: 'roomId', description: 'The ID of the room to start', type: 'string' })
  @ApiBody({ type: StartGameDto })
  @ApiResponse({ status: 200, description: 'Game started successfully.', type: Room })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g., room not waiting, no players)' })
  @ApiResponse({ status: 403, description: 'Forbidden (only host can start)' })
  @ApiResponse({ status: 404, description: 'Room not found' })
  startGame(
    @Param('roomId') roomId: string,
    @Body() startGameDto: StartGameDto,
  ): Promise<Room> {
    return this.waitingRoomService.startGame(roomId, startGameDto.hostId);
  }
}
