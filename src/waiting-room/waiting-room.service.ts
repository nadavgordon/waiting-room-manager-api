import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room, RoomStatus } from './entities/room.entity';

// DTOs will be created later, for now using partials or direct params
export interface CreateRoomDto {
  name: string;
  maxPlayers?: number;
  hostId: string;
}

export interface UpdateRoomDto {
  name?: string;
  maxPlayers?: number;
  status?: RoomStatus;
}

@Injectable()
export class WaitingRoomService {
  constructor(
    @InjectRepository(Room)
    private readonly roomRepository: Repository<Room>,
  ) {}

  async createRoom(createRoomDto: CreateRoomDto): Promise<Room> {
    const newRoom = this.roomRepository.create({
      ...createRoomDto,
      // status will default to 'waiting' as per entity definition
    });
    return this.roomRepository.save(newRoom);
  }

  async findAllRooms(): Promise<Room[]> {
    return this.roomRepository.find();
  }

  async findRoomById(id: string): Promise<Room> {
    const room = await this.roomRepository.findOneBy({ id });
    if (!room) {
      throw new NotFoundException(`Room with ID "${id}" not found`);
    }
    return room;
  }

  async updateRoom(id: string, updateRoomDto: UpdateRoomDto): Promise<Room> {
    const room = await this.findRoomById(id); // leverages existing find and NotFoundException
    // More sophisticated update logic might be needed, e.g. for partial updates
    // or to prevent certain status transitions.
    Object.assign(room, updateRoomDto);
    return this.roomRepository.save(room);
  }

  async deleteRoom(id: string): Promise<void> {
    const result = await this.roomRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Room with ID "${id}" not found`);
    }
  }

  // Placeholder for more complex logic, e.g., adding a player to a room
  // async addUserToRoom(roomId: string, userId: string): Promise<Room> { ... }

  // Placeholder for changing room status, e.g., starting a game
  // async changeRoomStatus(roomId: string, newStatus: RoomStatus): Promise<Room> { ... }
}
