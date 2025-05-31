import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { LoggerService } from '../common/logger/logger.service';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { Repository, Not, IsNull } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private readonly logger: LoggerService,
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
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
      this.logger.warn(
        `User not found during validation: ${username}`,
        'AuthService',
      );
      return null;
    }
    // Securely compare the provided password with the stored hash using bcrypt.
    if (!(await bcrypt.compare(pass, user.passwordHash))) {
      this.logger.warn(
        `Invalid credentials for user: ${username}`,
        'AuthService',
      );
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
    this.logger.log(
      `User login initiated for: ${user.username}`,
      'AuthService',
    );
    const payload = {
      username: user.username,
      sub: user.id,
      nonce: Date.now(), // Add a timestamp to ensure each token is unique
    };
    const accessToken = this.jwtService.sign(payload);

    const refreshToken = uuidv4();
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExpiresAt = new Date();
    refreshTokenExpiresAt.setDate(refreshTokenExpiresAt.getDate() + 7); // Refresh token valid for 7 days

    await this.usersRepository.update(user.id, {
      refreshTokenHash,
      refreshTokenExpiresAt,
    });

    this.logger.log(
      `User ${user.username} logged in successfully.`,
      'AuthService',
    );
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in:
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '1h',
    };
  }

  /**
   * Refreshes an access token using a valid refresh token.
   * @param refreshToken The refresh token provided by the client.
   * @returns An object containing a new `access_token` and `refresh_token`.
   * @throws UnauthorizedException if the refresh token is invalid or expired.
   */
  async refreshTokens(refreshToken: string) {
    this.logger.log('Attempting to refresh tokens', 'AuthService');

    // Find all users with a non-null refreshTokenHash
    const users = await this.usersRepository.find({
      where: [{ refreshTokenHash: Not(IsNull()) }],
    });

    // Find the user with the matching refresh token
    const user = users.find(
      (u) =>
        u.refreshTokenHash &&
        bcrypt.compareSync(refreshToken, u.refreshTokenHash),
    );

    if (
      !user ||
      !user.refreshTokenExpiresAt ||
      user.refreshTokenExpiresAt < new Date()
    ) {
      this.logger.warn('Invalid or expired refresh token', 'AuthService');
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Invalidate the old refresh token by clearing it from the user entity
    await this.usersRepository.update(user.id, {
      refreshTokenHash: null,
      refreshTokenExpiresAt: null,
    });

    // Generate new access and refresh tokens
    const payload = {
      username: user.username,
      sub: user.id,
      nonce: Date.now(), // Add a timestamp to ensure each token is unique
    };
    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = uuidv4();
    const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);
    const newRefreshTokenExpiresAt = new Date();
    newRefreshTokenExpiresAt.setDate(newRefreshTokenExpiresAt.getDate() + 7);

    await this.usersRepository.update(user.id, {
      refreshTokenHash: newRefreshTokenHash,
      refreshTokenExpiresAt: newRefreshTokenExpiresAt,
    });

    this.logger.log(
      `Tokens refreshed successfully for user: ${user.username}`,
      'AuthService',
    );
    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      expires_in:
        this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
        '1h',
    };
  }

  /**
   * Revokes an access token by adding it to a blacklist.
   * @param token The JWT access token to revoke.
   * @returns True if the token was successfully blacklisted.
   */
  async revokeToken(token: string): Promise<boolean> {
    this.logger.log('Attempting to revoke token', 'AuthService');
    const decodedToken = this.jwtService.decode(token);
    if (
      !decodedToken ||
      typeof decodedToken === 'string' ||
      !decodedToken.exp
    ) {
      this.logger.warn('Invalid token for revocation', 'AuthService');
      return false;
    }

    const expiresIn = decodedToken.exp - Math.floor(Date.now() / 1000); // Time until expiration in seconds
    if (expiresIn > 0) {
      await this.cacheManager.set(`blacklist:${token}`, 1, expiresIn * 1000); // Store in cache with token's remaining TTL
      this.logger.log(
        `Token blacklisted successfully. Expires in ${expiresIn} seconds.`,
        'AuthService',
      );
      return true;
    }
    this.logger.warn(
      'Token already expired, no need to blacklist.',
      'AuthService',
    );
    return false;
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
      this.logger.warn(
        `Registration failed: Username already exists: ${username}`,
        'AuthService',
      );
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
