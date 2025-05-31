import { Test, TestingModule } from '@nestjs/testing';
import { WaitingRoomGateway } from '../src/waiting-room/waiting-room.gateway';
import { WaitingRoomService } from '../src/waiting-room/waiting-room.service';
import { Server, Socket } from 'socket.io';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity'; // Import Room and RoomStatus
import { User } from '../src/user/entities/user.entity'; // Import User entity
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../src/user/user.service';
import { UnauthorizedException } from '@nestjs/common';
import { WsAuthGuard } from '../src/auth/ws-auth.guard';
import { JoinRoomDto } from '../src/waiting-room/dto/join-room.dto';
import { LeaveRoomDto } from '../src/waiting-room/dto/leave-room.dto';

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
  let jwtService: JwtService; // Added for direct mocking in tests
  let userService: UserService; // Added for direct mocking in tests
  let wsAuthGuard: WsAuthGuard; // Added for direct mocking in tests

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
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findOne: jest.fn(),
          },
        },
        WsAuthGuard, // Provide the actual guard
      ],
    }).compile();

    gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
    service = module.get<WaitingRoomService>(WaitingRoomService); // Get the mocked service instance
    jwtService = module.get<JwtService>(JwtService); // Get the mocked JwtService instance
    userService = module.get<UserService>(UserService); // Get the mocked UserService instance
    wsAuthGuard = module.get<WsAuthGuard>(WsAuthGuard); // Get the WsAuthGuard instance

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
    it('should successfully handle connection with valid JWT', async () => {
      const mockToken = 'valid-jwt-token';
      const mockUser: User = {
        id: 'user-id-1',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        refreshTokenHash: 'hashedRefreshToken',
        refreshTokenExpiresAt: new Date(Date.now() + 3600000),
        hostedRooms: [],
        roomPlayers: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockPayload = { sub: mockUser.id };

      (jwtService.verify as jest.Mock).mockReturnValue(mockPayload);
      (userService.findOne as jest.Mock).mockResolvedValue(mockUser);

      const client = {
        handshake: { headers: { authorization: `Bearer ${mockToken}` } },
        data: {},
        id: 'socket-id-1',
        disconnect: jest.fn(),
      } as unknown as Socket;

      const loggerSpy = jest.spyOn(gateway['logger'], 'log');

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
      expect(userService.findOne).toHaveBeenCalledWith(mockUser.id);
      expect(client.data.user).toEqual(mockUser);
      expect(loggerSpy).toHaveBeenCalledWith(`Client connected: ${client.id} (User: ${mockUser.username})`);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if no authorization token is provided', async () => {
      const client = {
        handshake: { headers: {} },
        data: {},
        id: 'socket-id-2',
        disconnect: jest.fn(),
      } as unknown as Socket;

      const loggerSpy = jest.spyOn(gateway['logger'], 'error');

      await gateway.handleConnection(client);

      expect(loggerSpy).toHaveBeenCalledWith(`Client connection failed: ${client.id} - No authorization token provided.`);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should throw UnauthorizedException if JWT is invalid', async () => {
      const mockToken = 'invalid-jwt-token';

      (jwtService.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const client = {
        handshake: { headers: { authorization: `Bearer ${mockToken}` } },
        data: {},
        id: 'socket-id-3',
        disconnect: jest.fn(),
      } as unknown as Socket;

      const loggerSpy = jest.spyOn(gateway['logger'], 'error');

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
      expect(loggerSpy).toHaveBeenCalledWith(`Client connection failed: ${client.id} - Invalid token`);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should throw UnauthorizedException if user is not found', async () => {
      const mockToken = 'valid-jwt-token';
      const mockPayload = { sub: 'non-existent-user-id' };

      (jwtService.verify as jest.Mock).mockReturnValue(mockPayload);
      (userService.findOne as jest.Mock).mockResolvedValue(null);

      const client = {
        handshake: { headers: { authorization: `Bearer ${mockToken}` } },
        data: {},
        id: 'socket-id-4',
        disconnect: jest.fn(),
      } as unknown as Socket;

      const loggerSpy = jest.spyOn(gateway['logger'], 'error');

      await gateway.handleConnection(client);

      expect(jwtService.verify).toHaveBeenCalledWith(mockToken);
      expect(userService.findOne).toHaveBeenCalledWith(mockPayload.sub);
      expect(loggerSpy).toHaveBeenCalledWith(`Client connection failed: ${client.id} - User not found.`);
      expect(client.disconnect).toHaveBeenCalledWith(true);
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
      const loggerSpy = jest.spyOn(gateway['logger'], 'log'); // Spy on logger.log
      await gateway.handleDisconnect(mockSocketClient as any); // Simulate a client disconnection
      expect(loggerSpy).toHaveBeenCalledWith(`Client disconnected: ${mockSocketClient.id}`);
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
        refreshTokenHash: 'someHashedRefreshToken', // Added missing property
        refreshTokenExpiresAt: new Date(), // Added missing property
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
    let localWsAuthGuard: { canActivate: jest.Mock }; // Declare a local mock for the guard

    beforeEach(async () => {
      localWsAuthGuard = { canActivate: jest.fn() }; // Initialize the mock
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WaitingRoomGateway,
          { provide: WaitingRoomService, useValue: {} },
          { provide: JwtService, useValue: { verify: jest.fn() } },
          { provide: UserService, useValue: { findOne: jest.fn() } },
          {
            provide: WsAuthGuard, // Provide the mock instead of the actual guard
            useValue: localWsAuthGuard,
          },
        ],
      }).compile();

      gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
      // Assign the local mock to the global wsAuthGuard for consistency if needed elsewhere,
      // but for this describe block, localWsAuthGuard is sufficient.
      wsAuthGuard = localWsAuthGuard as unknown as WsAuthGuard;
      (gateway as any).server = mockIoServer;
    });

    /**
     * Test case: Verifies that the client joins the specified room and logs the action.
     */
    it('should join the client to the specified room and log', async () => {
      // Mock the WsAuthGuard to allow activation
      localWsAuthGuard.canActivate.mockReturnValue(true);

      const joinRoomDto: JoinRoomDto = { roomId: 'room1' };
      const loggerSpy = jest.spyOn(gateway['logger'], 'log'); // Spy on logger.log
      await gateway.handleJoinRoomUpdates(joinRoomDto, mockSocketClient as any); // Simulate a join room update message
      expect(mockSocketClient.join).toHaveBeenCalledWith(joinRoomDto.roomId); // Verify client joined the room
      expect(loggerSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} (User: ${mockSocketClient.data.user.username}) joined room updates for room: ${joinRoomDto.roomId}`);
    });
  });

  /**
   * Test suite for `handleLeaveRoomUpdates` method (WebSocket message handler).
   */
  describe('handleLeaveRoomUpdates', () => {
    let localWsAuthGuard: { canActivate: jest.Mock }; // Declare a local mock for the guard

    beforeEach(async () => {
      localWsAuthGuard = { canActivate: jest.fn() }; // Initialize the mock
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          WaitingRoomGateway,
          { provide: WaitingRoomService, useValue: {} },
          { provide: JwtService, useValue: { verify: jest.fn() } },
          { provide: UserService, useValue: { findOne: jest.fn() } },
          {
            provide: WsAuthGuard, // Provide the mock instead of the actual guard
            useValue: localWsAuthGuard,
          },
        ],
      }).compile();

      gateway = module.get<WaitingRoomGateway>(WaitingRoomGateway);
      // Assign the local mock to the global wsAuthGuard for consistency if needed elsewhere,
      // but for this describe block, localWsAuthGuard is sufficient.
      wsAuthGuard = localWsAuthGuard as unknown as WsAuthGuard;
      (gateway as any).server = mockIoServer;
    });

    /**
     * Test case: Verifies that the client leaves the specified room and logs the action.
     */
    it('should leave the client from the specified room and log', async () => {
      // Mock the WsAuthGuard to allow activation
      localWsAuthGuard.canActivate.mockReturnValue(true);

      const leaveRoomDto: LeaveRoomDto = { roomId: 'room1' };
      const loggerSpy = jest.spyOn(gateway['logger'], 'log'); // Spy on logger.log
      await gateway.handleLeaveRoomUpdates(leaveRoomDto, mockSocketClient as any); // Simulate a leave room update message
      expect(mockSocketClient.leave).toHaveBeenCalledWith(leaveRoomDto.roomId); // Verify client left the room
      expect(loggerSpy).toHaveBeenCalledWith(`Client ${mockSocketClient.id} (User: ${mockSocketClient.data.user.username}) left room updates for room: ${leaveRoomDto.roomId}`);
    });
  });
});