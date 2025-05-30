import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Room } from './entities/room.entity';

@WebSocketGateway({
  // Configures CORS for WebSocket connections, allowing specified origins to connect.
  // This is crucial for frontend applications hosted on different domains.
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    credentials: true,
  },
})
export class WaitingRoomGateway {
  // Injects the Socket.IO server instance, enabling the gateway to emit events to connected clients.
  @WebSocketServer() server: Server;

  /**
   * Handles new client connections.
   * This method is invoked when a new WebSocket connection is established.
   * It can be used for initial setup or logging of new clients.
   */
  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  /**
   * Handles client disconnections.
   * This method is invoked when a WebSocket client disconnects.
   * It can be used for cleanup or logging of disconnections.
   */
  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
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
  @SubscribeMessage('joinRoomUpdates')
  handleJoinRoomUpdates(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    client.join(roomId);
    console.log(`Client ${client.id} joined room updates for room: ${roomId}`);
  }

  /**
   * Handles 'leaveRoomUpdates' messages from clients.
   * When a client sends this message, they are removed from a Socket.IO "room".
   * This stops them from receiving further targeted updates for that specific waiting room.
   * @param roomId The ID of the room the client wishes to stop receiving updates from.
   * @param client The Socket.IO client requesting to leave the update stream.
   */
  @SubscribeMessage('leaveRoomUpdates')
  handleLeaveRoomUpdates(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    client.leave(roomId);
    console.log(`Client ${client.id} left room updates for room: ${roomId}`);
  }
}