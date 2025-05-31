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
export const GetUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    // The `user` property is typically attached to the request by Passport.js's JWT strategy
    // after a successful authentication.
    const user = request.user;

    // If a specific property name is provided (e.g., 'userId'), return that property.
    // Otherwise, return the entire user object.
    return data ? user?.[data] : user;
  },
);
