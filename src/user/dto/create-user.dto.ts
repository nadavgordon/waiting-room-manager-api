import { IsString, MinLength, Matches } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({
    description: 'The username for the new user',
    minLength: 3,
    example: 'john_doe',
  })
  @IsString()
  @MinLength(3)
  username: string;

  @ApiProperty({
    description: 'The password for the new user. Must be 8-12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    minLength: 8,
    maxLength: 12,
    example: 'Password123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,12}$/, {
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
  })
  password: string;
}