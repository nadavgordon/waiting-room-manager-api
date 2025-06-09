import { IsString, IsOptional, IsInt, Min, Max, IsEnum, MinLength, MaxLength } from 'class-validator';
import { RoomStatus } from '../entities/room.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateRoomDto {
  @ApiProperty({
    example: 'My Updated Room Name',
    description: 'The new name of the waiting room. If provided, must be 3-50 characters long.',
    required: false,
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiProperty({
    example: 20,
    description: 'The new maximum number of players allowed in the room',
    required: false,
    minimum: 2,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(100)
  maxPlayers?: number;

  @ApiProperty({
    example: RoomStatus.IN_PROGRESS,
    description: 'The new status of the room',
    enum: RoomStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;
}
