import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRoomDto {
  @ApiProperty({
    example: 'My Awesome Room',
    description: 'The name of the waiting room. Must be 3-50 characters long.',
    minLength: 3,
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(50)
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
    description:
      'Whether join requests require host approval (applies to private rooms)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  approvalRequired?: boolean;
}
