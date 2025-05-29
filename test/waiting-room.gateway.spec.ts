import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { WaitingRoomService } from '../src/waiting-room/waiting-room.service';
import { Server, Socket } from 'socket.io';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity'; // Import Room and RoomStatus
import { User } from '../src/user/entities/user.entity'; // Import User entity

// Mock for the socket.io server instance
const mockIoServer = {
  to: jest.fn().mockReturnThis(), // Allows chaining .to().emit()
  emit: jest.fn(),
  sockets: {
    adapter: {
      rooms: new Map(),
    },
  },
};

// Mock for a client socket
const mockSocketClient = {
  join: jest.fn(),
  leave: jest.fn(),
  emit: jest.fn(),
  data: { user: { userId: 'test-user-id', username: 'test-username' } },
  id: 'test-socket-id',
};

describe('WaitingRoomGateway', () => {
  let gateway: WaitingRoomGateway;
  let service: WaitingRoomService; // Keep service for mocking if gateway methods call it

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingRoomGateway,
        {
          provide: WaitingRoomService,
          useValue: {
            // Only mock methods that are actually called by the gateway's existing methods
            // Based on waiting-room.gateway.ts, no service methods are directly called in handleConnection/Disconnect
            // or the SubscribeMessage handlers.
          },
        },
      ],
    }).compile();

    gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
    service = module.get<WaitingRoomService>(WaitingRoomService); // Get the mocked service

    // Manually assign the mocked server to the gateway instance
    (gateway as any).server = mockIoServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log client connection', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      await gateway.handleConnection(mockSocketClient as any);
      expect(consoleSpy).toHaveBeenCalledWith(`Client connected: ${mockSocketClient.id}`);
      consoleSpy.mockRestore();
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnection', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      await gateway.handleDisconnect(mockSocketClient as any);
      expect(consoleSpy).toHaveBeenCalledWith(`Client disconnected: ${mockSocketClient.id}`);
      consoleSpy.mockRestore();
    });
  });

  describe('emitRoomUpdate', () => {
    it('should emit roomUpdated event to all clients', () => {
      const mockHost: User = {
        id: 'host-id',
        username: 'host-user',
        passwordHash: 'hashedpassword',
        hostedRooms: [],
        roomPlayers: [],
      };

      const mockRoom: Room = {
        id: 'room1',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 4,
        hostId: 'host-id',
        status: RoomStatus.WAITING, // Use enum
        createdAt: new Date(),
        updatedAt: new Date(),
        host: mockHost, // Use mock User object
        roomPlayers: [], // Mock as needed
      };
      gateway.emitRoomUpdate(mockRoom);
      expect(mockIoServer.emit).toHaveBeenCalledWith('roomUpdated', mockRoom);
    });
  });

  describe('emitRoomPlayersUpdate', () => {
    it('should emit roomPlayersUpdated event to a specific room', () => {
      const roomId = 'room1';
      const players = [{ userId: 'player1', status: RoomPlayerStatus.ACTIVE }];
      gateway.emitRoomPlayersUpdate(roomId, players);
      expect(mockIoServer.to).toHaveBeenCalledWith(roomId);
      expect(mockIoServer.to(roomId).emit).toHaveBeenCalledWith('roomPlayersUpdated', { roomId, players });
    });
  });

  describe('handleJoinRoomUpdates', () => {
    it('should join the client to the specified room and log', async () => {
      const roomId = 'room1';
      const consoleSpy = jest.spyOn(console, 'log');
      await gateway.handleJoinRoomUpdates(roomId, mockSocketClient as any);
      expect(mockSocketClient.join).toHaveBeenCalledWith(roomId);
      expect(consoleSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} joined room updates for room: ${roomId}`);
      consoleSpy.mockRestore();
    });
  });

  describe('handleLeaveRoomUpdates', () => {
    it('should leave the client from the specified room and log', async () => {
      const roomId = 'room1';
      const consoleSpy = jest.spyOn(console, 'log');
      await gateway.handleLeaveRoomUpdates(roomId, mockSocketClient as any);
      expect(mockSocketClient.leave).toHaveBeenCalledWith(roomId);
      expect(consoleSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} left room updates for room: ${roomId}`);
      consoleSpy.mockRestore();
    });
  });
});