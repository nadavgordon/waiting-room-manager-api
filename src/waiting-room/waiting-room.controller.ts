import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { WaitingRoomService } from './waiting-room.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';
import { Room } from './entities/room.entity';

@Controller('rooms') // Base path for all routes in this controller
export class WaitingRoomController {
  constructor(private readonly waitingRoomService: WaitingRoomService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createRoomDto: CreateRoomDto): Promise<Room> {
    return this.waitingRoomService.createRoom(createRoomDto);
  }

  @Get()
  async findAll(): Promise<Room[]> {
    return this.waitingRoomService.findAllRooms();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Room> {
    return this.waitingRoomService.findRoomById(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRoomDto: UpdateRoomDto,
  ): Promise<Room> {
    return this.waitingRoomService.updateRoom(id, updateRoomDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.waitingRoomService.deleteRoom(id);
  }
}
