import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * `JwtAuthGuard` is a NestJS authentication guard that leverages the 'jwt' strategy
   * configured in `JwtStrategy`. It protects routes by ensuring that incoming requests
   * have a valid JWT.
   *
   * The `canActivate` method is the entry point for the guard, determining if a request
   * should proceed. The `handleRequest` method processes the outcome of the authentication
   * attempt, either returning the authenticated user or throwing an `UnauthorizedException`.
   */

  /**
   * Determines if the request should be activated (allowed to proceed).
   * This method delegates to the underlying Passport.js 'jwt' strategy.
   * @param context The execution context of the current request.
   * @returns A boolean, Promise, or Observable indicating authorization status.
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    return super.canActivate(context);
  }

  /**
   * Handles the result of the authentication attempt by the 'jwt' strategy.
   * If authentication fails (due to error or missing user), it throws an `UnauthorizedException`.
   * Otherwise, it returns the authenticated user object, which NestJS then attaches to `req.user`.
   * @param err Any error encountered during authentication.
   * @param user The authenticated user object, if successful.
   * @param info Additional information from the authentication process.
   * @returns The authenticated user object.
   * @throws UnauthorizedException if authentication fails.
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw (
        err ||
        new UnauthorizedException(info?.message || 'User is not authenticated')
      );
    }
    return user;
  }
}
