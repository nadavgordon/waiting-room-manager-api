import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    this.logger.log(`Attempting to validate user: ${username}`, 'AuthService');
    const user = await this.userService.findOne(username);
    if (!user) {
      this.logger.warn(`User not found during validation: ${username}`, 'AuthService');
      return null;
    }
    if (!(await bcrypt.compare(pass, user.passwordHash))) {
      this.logger.warn(`Invalid credentials for user: ${username}`, 'AuthService');
      return null;
    }
    this.logger.log(`User validated successfully: ${username}`, 'AuthService');
    const { passwordHash, ...result } = user;
    return result;
  }

  async login(user: any) {
    this.logger.log(`User login initiated for: ${user.username}`, 'AuthService');
    const payload = { username: user.username, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    this.logger.log(`User ${user.username} logged in successfully.`, 'AuthService');
    return {
      access_token: accessToken,
    };
  }

  async register(username: string, password: string): Promise<any> {
    this.logger.log(`Attempting to register user: ${username}`, 'AuthService');
    const existingUser = await this.userService.findOne(username);
    if (existingUser) {
      this.logger.warn(`Registration failed: Username already exists: ${username}`, 'AuthService');
      throw new UnauthorizedException('Username already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userService.create(username, hashedPassword);
    this.logger.log(`User registered successfully: ${username}`, 'AuthService');
    const { passwordHash, ...result } = user;
    return result;
  }
}