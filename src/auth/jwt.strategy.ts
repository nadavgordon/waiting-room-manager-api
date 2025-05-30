import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * `JwtStrategy` integrates Passport.js with JWT authentication.
   * It defines how to extract the JWT from incoming requests and how to validate it.
   * Upon successful validation, the `validate` method processes the JWT payload
   * and returns a user object that will be attached to the request.
   */
  constructor(private configService: ConfigService) {
    super({
      // Specifies that the JWT should be extracted from the Authorization header as a Bearer token.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Ensures that expired tokens are rejected, enhancing security.
      ignoreExpiration: false,
      // The secret key used to verify the JWT's signature, retrieved from environment variables.
      secretOrKey: configService.get<string>('JWT_SECRET') ?? '',
    });
  }

  /**
   * Validates the decoded JWT payload.
   * This method is automatically called by Passport.js after a JWT is successfully extracted and verified.
   * The returned object is then attached to the `req.user` property, making user information
   * easily accessible in subsequent request handlers (controllers, guards).
   * @param payload The decoded JWT payload, typically containing user ID (`sub`) and username.
   * @returns An object representing the authenticated user.
   */
  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}