import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Inject } from '@nestjs/common';
import { LoggerService } from '../common/logger/logger.service';

/**
 * @file jwt-blacklist.strategy.ts
 * @description JWT strategy that checks if a token is blacklisted before validating it.
 * This strategy extends the standard JWT strategy to add token revocation support.
 */
@Injectable()
export class JwtBlacklistStrategy extends PassportStrategy(
  Strategy,
  'jwt-blacklist',
) {
  constructor(
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly logger: LoggerService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'fallback_secret_for_dev_only',
      passReqToCallback: true, // Pass the request to the validate method
    });
  }

  /**
   * Validates the decoded JWT payload and checks if the token is blacklisted.
   * @param request The HTTP request object
   * @param payload The decoded JWT payload
   * @returns An object representing the authenticated user
   * @throws UnauthorizedException if the token is blacklisted
   */
  async validate(request: any, payload: any) {
    // Extract the token from the Authorization header
    const token = request.headers.authorization.split(' ')[1];

    // Check if the token is blacklisted
    const isBlacklisted = await this.cacheManager.get(`blacklist:${token}`);
    if (isBlacklisted) {
      this.logger.warn(
        `Token is blacklisted: ${token.substring(0, 10)}...`,
        'JwtBlacklistStrategy',
      );
      throw new UnauthorizedException('Token has been revoked');
    }

    return { userId: payload.sub, username: payload.username };
  }
}
