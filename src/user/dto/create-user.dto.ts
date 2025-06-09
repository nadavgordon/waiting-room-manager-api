import { IsString, MinLength, Matches, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * `CreateUserDto` is a Data Transfer Object (DTO) used for validating and
 * structuring the data received when a new user registers.
 * It enforces a strong password policy using `class-validator` and provides
 * OpenAPI (Swagger) documentation via `@ApiProperty`.
 */
export class CreateUserDto {
  @ApiProperty({
    description: 'The username for the new user. Must be 3-30 characters long and can only contain alphanumeric characters and underscores.',
    minLength: 3,
    maxLength: 30,
    example: 'john_doe',
    pattern: '^[a-zA-Z0-9_]+$'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain alphanumeric characters and underscores',
  })
  username: string;

  @ApiProperty({
    description:
      'The password for the new user. Must be 8-12 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    minLength: 8,
    maxLength: 12,
    example: 'Password123!',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  // Regular expression to enforce password complexity:
  // - At least one lowercase letter (`(?=.*[a-z])`)
  // - At least one uppercase letter (`(?=.*[A-Z])`)
  // - At least one digit (`(?=.*\d)`)
  // - At least one special character (`(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?])`)
  // - Total length between 8 and 12 characters (`.{8,12}$`)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]).{8,12}$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character, and be between 8 and 12 characters long',
    },
  )
  password: string;
}
