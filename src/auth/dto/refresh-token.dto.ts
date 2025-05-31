import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Data Transfer Object (DTO) for refresh token requests.
 * This DTO defines the structure for the payload expected when a client
 * requests a new access token using a refresh token.
 */
export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refresh token obtained during login',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
