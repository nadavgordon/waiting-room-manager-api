import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `LoginUserDto` is a Data Transfer Object (DTO) used for validating and
 * structuring the credentials provided by a user during the login process.
 * It uses `class-validator` for basic type validation and `ApiProperty` for Swagger documentation.
 */
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
