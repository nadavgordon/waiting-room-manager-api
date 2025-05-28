import { IsString, IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { RoomStatus } from '../entities/room.entity';

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;

  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
