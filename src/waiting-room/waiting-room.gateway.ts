import { WebSocketGateway, SubscribeMessage, MessageBody, WebSocketServer, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Room } from './entities/room.entity';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [],
    credentials: true,
  },
})
export class WaitingRoomGateway {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket, ...args: any[]) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // Method to emit room updates
  emitRoomUpdate(room: Room) {
    this.server.emit('roomUpdated', room);
  }

  // Method to emit player updates for a specific room
  emitRoomPlayersUpdate(roomId: string, players: any[]) {
    this.server.to(roomId).emit('roomPlayersUpdated', { roomId, players });
  }

  // Example of a message handler (can be expanded as needed)
  @SubscribeMessage('joinRoomUpdates')
  handleJoinRoomUpdates(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    client.join(roomId);
    console.log(`Client ${client.id} joined room updates for room: ${roomId}`);
  }

  @SubscribeMessage('leaveRoomUpdates')
  handleLeaveRoomUpdates(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    client.leave(roomId);
    console.log(`Client ${client.id} left room updates for room: ${roomId}`);
  }
}