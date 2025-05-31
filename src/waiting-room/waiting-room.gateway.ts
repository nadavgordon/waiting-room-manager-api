import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe, UnauthorizedException } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { Room } from './entities/room.entity';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { WsAuthGuard } from '../auth/ws-auth.guard';
import { JoinRoomDto } from './dto/join-room.dto';
import { LeaveRoomDto } from './dto/leave-room.dto';

@WebSocketGateway({
  // Configures CORS for WebSocket connections, allowing specified origins to connect.
  // This is crucial for frontend applications hosted on different domains.
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    credentials: true,
  },
})
export class WaitingRoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(WaitingRoomGateway.name);

  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  /**
   * Handles new client connections.
   * This method is invoked when a new WebSocket connection is established.
   * It can be used for initial setup or logging of new clients.
   */
  async handleConnection(client: Socket, ...args: any[]) {
    try {
      const authToken = client.handshake.headers.authorization?.split(' ')[1];
      if (!authToken) {
        throw new UnauthorizedException('No authorization token provided.');
      }
      const payload = this.jwtService.verify(authToken);
      const user = await this.userService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('User not found.');
      }
      client.data.user = user;
      this.logger.log(`Client connected: ${client.id} (User: ${user.username})`);
    } catch (error) {
      this.logger.error(`Client connection failed: ${client.id} - ${error.message}`);
      client.disconnect(true);
    }
  }

  /**
   * Handles client disconnections.
   * This method is invoked when a WebSocket client disconnects.
   * It can be used for cleanup or logging of disconnections.
   */
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * Emits a 'roomUpdated' event to all connected clients.
   * This broadcast mechanism ensures that all clients receive general updates
   * about any room, maintaining a consistent view of room states across the application.
   * @param room The updated `Room` object to be broadcast.
   */
  emitRoomUpdate(room: Room) {
    this.server.emit('roomUpdated', room);
  }

  /**
   * Emits a 'roomPlayersUpdated' event to clients subscribed to a specific room.
   * This targeted emission ensures that only relevant clients (those in a particular room)
   * receive updates about changes to the player list within that room.
   * @param roomId The ID of the room whose players have been updated.
   * @param players The updated list of players in the room.
   */
  emitRoomPlayersUpdate(roomId: string, players: any[]) {
    this.server.to(roomId).emit('roomPlayersUpdated', { roomId, players });
  }

  /**
   * Handles 'joinRoomUpdates' messages from clients.
   * When a client sends this message, they are added to a Socket.IO "room" (a logical grouping).
   * This allows the server to send targeted updates to clients interested in a specific waiting room.
   * @param roomId The ID of the room the client wishes to receive updates for.
   * @param client The Socket.IO client requesting to join the update stream.
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('joinRoomUpdates')
  handleJoinRoomUpdates(@MessageBody() joinRoomDto: JoinRoomDto, @ConnectedSocket() client: Socket) {
    client.join(joinRoomDto.roomId);
    this.logger.log(`Client ${client.id} (User: ${client.data.user.username}) joined room updates for room: ${joinRoomDto.roomId}`);
  }

  /**
   * Handles 'leaveRoomUpdates' messages from clients.
   * When a client sends this message, they are removed from a Socket.IO "room".
   * This stops them from receiving further targeted updates for that specific waiting room.
   * @param roomId The ID of the room the client wishes to stop receiving updates from.
   * @param client The Socket.IO client requesting to leave the update stream.
   */
  @UseGuards(WsAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @SubscribeMessage('leaveRoomUpdates')
  handleLeaveRoomUpdates(@MessageBody() leaveRoomDto: LeaveRoomDto, @ConnectedSocket() client: Socket) {
    client.leave(leaveRoomDto.roomId);
    this.logger.log(`Client ${client.id} (User: ${client.data.user.username}) left room updates for room: ${leaveRoomDto.roomId}`);
  }
}