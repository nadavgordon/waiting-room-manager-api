import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus, UnauthorizedException, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ThrottlerBehindProxyGuard } from '../common/guards/throttler-behind-proxy.guard';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Handles user registration.
   * This endpoint allows new users to create an account with a username and password.
   * The password policy is enforced via `CreateUserDto` validation.
   */
  @Post('register')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for registration
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered.',
    schema: { example: { username: 'john_doe', id: 'uuid-string' } },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request. Invalid input data, username already exists, or password policy violation.',
  })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto.username, createUserDto.password);
  }

  /**
   * Handles user login and JWT token issuance.
   * Upon successful validation of credentials, a JWT access token is returned,
   * which clients can use for subsequent authenticated requests.
   */
  @Post('login')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for login
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and receive JWT access token' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in and JWT token issued.',
    schema: { example: { access_token: 'eyJ...', refresh_token: 'uuid-string' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid username or password.' })
  async login(@Body() loginUserDto: LoginUserDto, @Request() req: any) {
    const user = await this.authService.validateUser(loginUserDto.username, loginUserDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  /**
   * Handles token refresh.
   * This endpoint allows clients to exchange a valid refresh token for a new access token.
   * It also issues a new refresh token to ensure continuous access without re-authentication.
   */
  @Post('refresh')
  @UseGuards(ThrottlerBehindProxyGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute for token refresh
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT access token using a refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Tokens successfully refreshed.',
    schema: { example: { access_token: 'eyJ...', refresh_token: 'uuid-string' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid or expired refresh token.' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken);
  }

  /**
   * Handles user logout and JWT token revocation.
   * This endpoint allows clients to invalidate their current access token,
   * preventing its further use even if it hasn't naturally expired.
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard) // Requires a valid access token to logout
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user and revoke JWT access token' })
  @ApiResponse({ status: 200, description: 'Token successfully revoked.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid or missing access token.' })
  async logout(@Request() req: any) {
    const token = req.headers.authorization.split(' ')[1]; // Extract token from Bearer header
    await this.authService.revokeToken(token);
    return { message: 'Logged out successfully' };
  }
}