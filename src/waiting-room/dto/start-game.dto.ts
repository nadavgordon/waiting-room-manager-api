import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class StartGameDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The UUID of the host starting the game (TEMPORARY - for use before auth is fully implemented)',
  })
  @IsUUID('4')
  @IsNotEmpty()
  hostId: string;
}
