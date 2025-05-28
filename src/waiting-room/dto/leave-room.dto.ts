import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNotEmpty } from 'class-validator';

export class LeaveRoomDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    description: 'The UUID of the user leaving the room',
  })
  @IsUUID('4')
  @IsNotEmpty()
  userId: string;
}
