import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({ example: 'My Awesome Room', description: 'The name of the waiting room' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 10,
    description: 'Maximum number of players allowed in the room',
    required: false,
    minimum: 2,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(2) // A room should have at least 2 players
  @Max(100) // Arbitrary upper limit for max players
  maxPlayers?: number;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The UUID of the host creating the room',
  })
  @IsUUID()
  @IsNotEmpty()
  hostId: string; // Assuming hostId is a UUID
}
