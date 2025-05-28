import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsUUID, IsBoolean } from 'class-validator';
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
    description: 'Whether the room is public or private',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiProperty({
    description: 'Whether join requests require host approval (applies to private rooms)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;

  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The UUID of the host creating the room',
  })
  @IsNotEmpty()
  @IsUUID('4') // Explicitly expect version 4
  hostId: string; // Assuming hostId is a UUID
}
