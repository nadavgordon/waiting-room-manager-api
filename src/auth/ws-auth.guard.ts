import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor() {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const client: Socket = context.switchToWs().getClient();
    const authToken = client.handshake.headers.authorization?.split(' ')[1];

    if (!authToken) {
      throw new UnauthorizedException('No authorization token provided.');
    }

    // Attach the token to the request for the JwtStrategy to pick up
    // This is a workaround as Passport-WS doesn't directly support Bearer token extraction from handshake
    client.handshake.headers.authorization = `Bearer ${authToken}`;

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _info: unknown,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _context?: ExecutionContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _status?: unknown,
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }
    // Return the user with the correct type
    return user as TUser;
  }
}
