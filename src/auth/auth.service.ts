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

  /**
   * Validates user credentials against the stored data.
   * This method is crucial for the login process, ensuring that the provided username
   * exists and the password matches its hashed counterpart.
   * @param username The username to validate.
   * @param pass The plain-text password provided by the user.
   * @returns The user object (without the password hash) if credentials are valid, otherwise `null`.
   */
  async validateUser(username: string, pass: string): Promise<any> {
    this.logger.log(`Attempting to validate user: ${username}`, 'AuthService');
    const user = await this.userService.findOne(username);
    if (!user) {
      this.logger.warn(`User not found during validation: ${username}`, 'AuthService');
      return null;
    }
    // Securely compare the provided password with the stored hash using bcrypt.
    if (!(await bcrypt.compare(pass, user.passwordHash))) {
      this.logger.warn(`Invalid credentials for user: ${username}`, 'AuthService');
      return null;
    }
    this.logger.log(`User validated successfully: ${username}`, 'AuthService');
    // Exclude the password hash from the returned user object for security.
    const { passwordHash, ...result } = user;
    return result;
  }

  /**
   * Generates a JSON Web Token (JWT) for an authenticated user.
   * This token is used for subsequent authorized requests to the API.
   * @param user The validated user object for whom the token is to be generated.
   * @returns An object containing the `access_token`.
   */
  async login(user: any) {
    this.logger.log(`User login initiated for: ${user.username}`, 'AuthService');
    // The JWT payload contains essential user information (username and ID).
    const payload = { username: user.username, sub: user.id };
    const accessToken = this.jwtService.sign(payload);
    this.logger.log(`User ${user.username} logged in successfully.`, 'AuthService');
    return {
      access_token: accessToken,
    };
  }

  /**
   * Registers a new user in the system.
   * This involves checking for existing usernames, hashing the password, and persisting the new user.
   * @param username The desired username for the new account.
   * @param password The plain-text password for the new account.
   * @returns The newly created user object (without the password hash).
   * @throws UnauthorizedException if the username already exists, preventing duplicate accounts.
   */
  async register(username: string, password: string): Promise<any> {
    this.logger.log(`Attempting to register user: ${username}`, 'AuthService');
    const existingUser = await this.userService.findOne(username);
    if (existingUser) {
      this.logger.warn(`Registration failed: Username already exists: ${username}`, 'AuthService');
      throw new UnauthorizedException('Username already exists');
    }
    // Hash the password using bcrypt with 10 salt rounds for strong security.
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.userService.create(username, hashedPassword);
    this.logger.log(`User registered successfully: ${username}`, 'AuthService');
    // Exclude the password hash from the returned user object.
    const { passwordHash, ...result } = user;
    return result;
  }
}