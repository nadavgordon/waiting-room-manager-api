import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginUserDto {
  @ApiProperty({
    description: 'The username of the user trying to log in',
    example: 'john_doe',
  })
  @IsString()
  username: string;

  @ApiProperty({
    description: 'The password of the user trying to log in',
    example: 'Password123!',
  })
  @IsString()
  password: string;
}