import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `LoginUserDto` is a Data Transfer Object (DTO) used for validating and
 * structuring the credentials provided by a user during the login process.
 * It uses `class-validator` for basic type validation and `ApiProperty` for Swagger documentation.
 */
export class LoginUserDto {
  @ApiProperty({
    description: 'The username of the user trying to log in. Must be 3-30 characters long.',
    example: 'john_doe',
    minLength: 3,
    maxLength: 30
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({
    description: 'The password of the user trying to log in. Must be at least 8 characters long.',
    example: 'Password123!',
    minLength: 8
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}
