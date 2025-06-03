import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * `@GetUser` is a custom NestJS parameter decorator designed to extract information
 * about the authenticated user from the request object.
 *
 * This decorator simplifies accessing user data (e.g., user ID, username) in controller
 * methods after a successful JWT authentication. It leverages NestJS's `createParamDecorator`
 * to tap into the execution context and retrieve the `user` object populated by Passport.js.
 *
 * Usage:
 * - `@GetUser()`: Injects the entire authenticated user object.
 * - `@GetUser('userId')`: Injects a specific property (e.g., `userId`) from the user object.
 */
/**
 * Interface defining the expected user object structure from JWT authentication
 */
interface JwtUser {
  userId: string;
  username: string;
  [key: string]: unknown;
}

export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const request = ctx.switchToHttp().getRequest();
    // The `user` property is typically attached to the request by Passport.js's JWT strategy
    // after a successful authentication.
    const req = request as Record<string, unknown>;

    if (!req.user || typeof req.user !== 'object') {
      return null;
    }

    // Type assertion after validation
    const userObj = req.user as Record<string, unknown>;
    const user = userObj as JwtUser;

    // If a specific property name is provided (e.g., 'userId'), return that property.
    // Otherwise, return the entire user object.
    if (data && typeof data === 'string' && data in user) {
      return user[data as keyof JwtUser];
    }
    return user;
  },
);
