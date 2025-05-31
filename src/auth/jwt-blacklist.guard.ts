import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

/**
 * @file jwt-blacklist.guard.ts
 * @description Authentication guard that uses the jwt-blacklist strategy.
 * This guard ensures that revoked tokens cannot be used for authentication.
 */
@Injectable()
export class JwtBlacklistGuard extends AuthGuard('jwt-blacklist') {
  /**
   * Determines if the request should be activated (allowed to proceed).
   * This method delegates to the underlying Passport.js 'jwt-blacklist' strategy.
   * @param context The execution context of the current request.
   * @returns A boolean, Promise, or Observable indicating authorization status.
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /**
   * Handles the result of the authentication attempt by the 'jwt-blacklist' strategy.
   * If authentication fails (due to error, missing user, or blacklisted token), it throws an `UnauthorizedException`.
   * Otherwise, it returns the authenticated user object, which NestJS then attaches to `req.user`.
   * @param err Any error encountered during authentication.
   * @param user The authenticated user object, if successful.
   * @param info Additional information from the authentication process.
   * @returns The authenticated user object.
   * @throws UnauthorizedException if authentication fails.
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException(info?.message || 'User is not authenticated or token is revoked');
    }
    return user;
  }
}