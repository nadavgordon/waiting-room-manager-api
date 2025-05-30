import { Controller, Get, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetUser } from '../auth/get-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('User')
@Controller('user')
@UseGuards(JwtAuthGuard) // Protects all endpoints in this controller, requiring a valid JWT.
@ApiBearerAuth('access-token') // Documents that these endpoints require a Bearer token in Swagger UI.
export class UserController {
  /**
   * Retrieves the profile of the currently authenticated user.
   * This endpoint demonstrates how to access authenticated user information
   * using the custom `@GetUser` decorator.
   */
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retrieve the profile of the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'User profile successfully retrieved.',
    schema: {
      example: {
        id: 'uuid-string',
        username: 'john_doe',
        createdAt: '2023-01-01T12:00:00Z',
        updatedAt: '2023-01-01T12:00:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid or missing JWT token.' })
  async getProfile(@GetUser() user: User): Promise<User> {
    // The `user` object is populated by `JwtAuthGuard` and `@GetUser` decorator
    // from the validated JWT payload. No further database lookup is needed here.
    return user;
  }
}