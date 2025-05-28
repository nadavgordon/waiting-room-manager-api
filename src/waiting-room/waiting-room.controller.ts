import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Waiting Room') // Tag for grouping endpoints in Swagger UI
@Controller('rooms') // Base path for all routes in this controller
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
  @ApiOperation({ summary: 'Get all waiting rooms' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved all rooms.', type: [Room] })
  async findAll(): Promise<Room[]> {
    return this.waitingRoomService.findAllRooms();
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a specific waiting room by ID' })
  @ApiResponse({ status: 204, description: 'The room has been successfully deleted.' })
  @ApiResponse({ status: 404, description: 'Room not found.' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.waitingRoomService.deleteRoom(id);
  }
}
