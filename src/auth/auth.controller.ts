import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { LoginUserDto } from '../user/dto/login-user.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
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

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and receive JWT access token' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in and JWT token issued.',
    schema: { example: { access_token: 'eyJ...' } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized. Invalid username or password.' })
  async login(@Body() loginUserDto: LoginUserDto, @Request() req: any) {
    const user = await this.authService.validateUser(loginUserDto.username, loginUserDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }
}