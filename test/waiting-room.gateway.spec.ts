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

/**
 * @file waiting-room.gateway.spec.ts
 * @description Unit tests for the `WaitingRoomGateway`.
 * These tests focus on the WebSocket gateway's ability to handle client connections,
 * disconnections, and emit real-time updates related to waiting rooms and players.
 * Mocks are used for the Socket.IO server and client sockets to isolate the gateway's logic.
 */
describe('WaitingRoomGateway', () => {
  let gateway: WaitingRoomGateway;
  let service: WaitingRoomService; // The mocked WaitingRoomService

  // Mock for the socket.io server instance.
  // This mock allows us to spy on `to` and `emit` methods to verify WebSocket events.
  const mockIoServer = {
    to: jest.fn().mockReturnThis(), // Allows chaining .to().emit()
    emit: jest.fn(),
    sockets: {
      adapter: {
        rooms: new Map(), // Mock the rooms map for internal adapter logic if needed
      },
    },
  };

  // Mock for a client socket.
  // This mock allows us to spy on `join`, `leave`, and `emit` methods for client-side interactions.
  const mockSocketClient = {
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
    data: { user: { userId: 'test-user-id', username: 'test-username' } }, // Mock user data attached to socket
    id: 'test-socket-id', // Mock socket ID
  };

  /**
   * Sets up the testing module and injects the gateway and mocked service before each test.
   */
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitingRoomGateway,
        {
          provide: WaitingRoomService,
          useValue: {
            // Only mock methods that are actually called by the gateway's existing methods.
            // In this gateway, service methods are not directly called in handleConnection/Disconnect
            // or the SubscribeMessage handlers, so an empty mock is sufficient for now.
          },
        },
      ],
    }).compile();

    gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
    service = module.get<WaitingRoomService>(WaitingRoomService); // Get the mocked service instance

    // Manually assign the mocked server to the gateway instance's `server` property.
    // This is necessary because `@WebSocketServer()` decorator assigns the real server at runtime.
    (gateway as any).server = mockIoServer;
  });

  /**
   * Clears all Jest mocks after each test to ensure test isolation.
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test case: Ensures the gateway instance is defined.
   */
  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  /**
   * Test suite for `handleConnection` method.
   */
  describe('handleConnection', () => {
    /**
     * Test case: Verifies that client connection is logged.
     */
    it('should log client connection', async () => {
      const consoleSpy = jest.spyOn(console, 'log'); // Spy on console.log
      await gateway.handleConnection(mockSocketClient as any); // Simulate a client connection
      expect(consoleSpy).toHaveBeenCalledWith(`Client connected: ${mockSocketClient.id}`);
      consoleSpy.mockRestore(); // Restore original console.log
    });
  });

  /**
   * Test suite for `handleDisconnect` method.
   */
  describe('handleDisconnect', () => {
    /**
     * Test case: Verifies that client disconnection is logged.
     */
    it('should log client disconnection', async () => {
      const consoleSpy = jest.spyOn(console, 'log'); // Spy on console.log
      await gateway.handleDisconnect(mockSocketClient as any); // Simulate a client disconnection
      expect(consoleSpy).toHaveBeenCalledWith(`Client disconnected: ${mockSocketClient.id}`);
      consoleSpy.mockRestore(); // Restore original console.log
    });
  });

  /**
   * Test suite for `emitRoomUpdate` method.
   */
  describe('emitRoomUpdate', () => {
    /**
     * Test case: Verifies that `roomUpdated` event is emitted to all clients.
     */
    it('should emit roomUpdated event to all clients', () => {
      // Create a mock User object for the room host.
      const mockHost: User = {
        id: 'host-id',
        username: 'host-user',
        passwordHash: 'hashedpassword',
        hostedRooms: [],
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create a mock Room object to be emitted.
      const mockRoom: Room = {
        id: 'room1',
        name: 'Test Room',
        isPublic: true,
        approvalRequired: false,
        maxPlayers: 4,
        hostId: 'host-id',
        status: RoomStatus.WAITING, // Use enum for status
        createdAt: new Date(),
        updatedAt: new Date(),
        host: mockHost, // Assign the mock host
        roomPlayers: [], // Mock as needed for the test scenario
      };
      gateway.emitRoomUpdate(mockRoom); // Call the method to be tested
      expect(mockIoServer.emit).toHaveBeenCalledWith('roomUpdated', mockRoom); // Verify the event was emitted
    });
  });

  /**
   * Test suite for `emitRoomPlayersUpdate` method.
   */
  describe('emitRoomPlayersUpdate', () => {
    /**
     * Test case: Verifies that `roomPlayersUpdated` event is emitted to a specific room.
     */
    it('should emit roomPlayersUpdated event to a specific room', () => {
      const roomId = 'room1';
      const players = [{ userId: 'player1', status: RoomPlayerStatus.ACTIVE }]; // Mock player data
      gateway.emitRoomPlayersUpdate(roomId, players); // Call the method to be tested
      expect(mockIoServer.to).toHaveBeenCalledWith(roomId); // Verify `to` method was called with the room ID
      expect(mockIoServer.to(roomId).emit).toHaveBeenCalledWith('roomPlayersUpdated', { roomId, players }); // Verify the event was emitted to the specific room
    });
  });

  /**
   * Test suite for `handleJoinRoomUpdates` method (WebSocket message handler).
   */
  describe('handleJoinRoomUpdates', () => {
    /**
     * Test case: Verifies that the client joins the specified room and logs the action.
     */
    it('should join the client to the specified room and log', async () => {
      const roomId = 'room1';
      const consoleSpy = jest.spyOn(console, 'log'); // Spy on console.log
      await gateway.handleJoinRoomUpdates(roomId, mockSocketClient as any); // Simulate a join room update message
      expect(mockSocketClient.join).toHaveBeenCalledWith(roomId); // Verify client joined the room
      expect(consoleSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} joined room updates for room: ${roomId}`);
      consoleSpy.mockRestore(); // Restore original console.log
    });
  });

  /**
   * Test suite for `handleLeaveRoomUpdates` method (WebSocket message handler).
   */
  describe('handleLeaveRoomUpdates', () => {
    /**
     * Test case: Verifies that the client leaves the specified room and logs the action.
     */
    it('should leave the client from the specified room and log', async () => {
      const roomId = 'room1';
      const consoleSpy = jest.spyOn(console, 'log'); // Spy on console.log
      await gateway.handleLeaveRoomUpdates(roomId, mockSocketClient as any); // Simulate a leave room update message
      expect(mockSocketClient.leave).toHaveBeenCalledWith(roomId); // Verify client left the room
      expect(consoleSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} left room updates for room: ${roomId}`);
      consoleSpy.mockRestore(); // Restore original console.log
    });
  });
});