import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { JoinRequestDecision } from '../src/waiting-room/dto/respond-to-join-request.dto';
import { JwtAuthGuard } from './../src/auth/jwt-auth.guard';
import { DataSource } from 'typeorm';
import { User } from '../src/user/entities/user.entity';
import { Room, RoomStatus } from '../src/waiting-room/entities/room.entity';
import { RoomPlayer } from '../src/waiting-room/entities/room-player.entity';
import { RoomPlayerStatus } from '../src/waiting-room/enums/room-player-status.enum';

/**
 * @file waiting-room.e2e-spec.ts
 * @description End-to-end tests for the Waiting Room module.
 * These tests cover the full lifecycle of waiting rooms, including creation, joining,
 * leaving, room management (update, delete, respond to join requests), and starting games.
 * They interact with the live NestJS application and a real database (via global setup/teardown).
 */
describe('WaitingRoom (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource; // TypeORM DataSource for direct database interactions in tests
  let accessToken: string; // JWT access token for the primary test user (host)
  let userId: string; // ID of the primary test user (host)
  let hostAccessToken: string; // JWT access token for a dedicated host user
  let hostUserId: string; // ID of the dedicated host user

  /**
   * Global setup for all Waiting Room E2E tests.
   * This runs once before all tests in this describe block.
   * It initializes the NestJS application, sets up global pipes,
   * and registers/logs in a primary test user to obtain an access token for authenticated requests.
   */
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule, // Import the main application module
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Apply global validation pipes to ensure DTO validation rules are enforced during E2E tests.
    app.useGlobalPipes(new (require('@nestjs/common').ValidationPipe)({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init(); // Initialize the NestJS application

    dataSource = app.get(DataSource); // Get the TypeORM DataSource instance

    // Register and login a user to get an access token for subsequent authenticated requests.
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser_wr', password: 'Password123!' })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testuser_wr', password: 'Password123!' })
      .expect(200);

    accessToken = loginRes.body.access_token; // Store the access token
    const user = await dataSource.getRepository(User).findOne({ where: { username: 'testuser_wr' } });
    if (!user) { // Add null check and throw error if user not found
      console.error('[E2E Setup] CRITICAL: User "testuser_wr" not found after login attempt.');
      throw new Error('Test user "testuser_wr" not found after login.');
    }
    userId = user.id; // Store the user ID
  });

  /**
   * Global teardown for all Waiting Room E2E tests.
   * This runs once after all tests in this describe block.
   * It closes the NestJS application to release resources.
   */
  afterAll(async () => {
    if (app) {
      await app.close(); // Close the NestJS application
    }
  });

  /**
   * Per-test setup.
   * This block is intentionally left mostly empty as database cleanup is handled
   * by `global-setup.ts` and `global-teardown.ts` for the entire test run.
   * Individual test cleanup for entities created within tests should be handled
   * by deleting those specific entities.
   */
  beforeEach(async () => {
    // Clear tables before each test to ensure a clean state, respecting foreign key constraints
    // These are handled by global-setup and global-teardown for the entire test run.
    // Individual test cleanup will be handled by deleting specific entities created within tests.
  });

  /**
   * Test suite for Room Creation functionality.
   */
  describe('Room Creation', () => {
    /**
     * Test case: Should successfully create a new waiting room.
     * Verifies that a POST request to '/rooms' with valid room data
     * and an authenticated user creates a new room and returns its details.
     */
    it('should create a new waiting room', async () => {
      const createRoomDto = {
        name: 'Test Room',
        maxPlayers: 4,
      };

      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`) // Authenticate with host's access token
        .send(createRoomDto)
        .expect(201); // Expect HTTP status 201 (Created)

      expect(response.body).toHaveProperty('id'); // Ensure room ID is present
      expect(response.body.name).toBe(createRoomDto.name);
      expect(response.body.maxPlayers).toBe(createRoomDto.maxPlayers);
      expect(response.body.host.id).toBe(userId); // Verify the host is the creating user
    });

    /**
     * Test case: Should not create a room with invalid data.
     * Verifies that a POST request to '/rooms' with invalid room data
     * (e.g., empty name, zero maxPlayers) returns a 400 Bad Request status.
     */
    it('should not create a room with invalid data', () => {
      return request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '', maxPlayers: 0 }) // Send invalid room data
        .expect(400); // Expect HTTP status 400 (Bad Request)
    });
  });

  /**
   * Test suite for Joining and Leaving Rooms functionality.
   */
  describe('Joining and Leaving Rooms', () => {
    let roomId: string; // ID of the room created for these tests
    let playerJoinAccessToken: string; // Access token for a player user
    let playerJoinUserId: string; // ID of the player user

    /**
     * Setup for joining/leaving tests.
     * Registers and logs in a separate player user to simulate a non-host joining.
     */
    beforeAll(async () => {
      // Register and login a player user for joining/leaving tests
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'playeruser_join', password: 'Password123!' })
        .expect(201);

      const playerLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'playeruser_join', password: 'Password123!' })
        .expect(200);
      playerJoinAccessToken = playerLoginRes.body.access_token;
      const playerUser = await dataSource.getRepository(User).findOne({ where: { username: 'playeruser_join' } });
      if (!playerUser) {
        throw new Error('Player user for join/leave tests not found after registration.');
      }
      playerJoinUserId = playerUser.id;
    });

    /**
     * Creates a new room before each test in this suite to ensure a fresh state.
     * The room is created by the primary test user (host).
     */
    beforeEach(async () => {
      // Create a room for joining tests by the main accessToken (host)
      const createRoomDto = {
        name: 'Joinable Room',
        maxPlayers: 2,
      };
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`) // Host creates the room
        .send(createRoomDto)
        .expect(201);
      roomId = response.body.id; // Store the created room's ID
    });

    /**
     * Test case: Should allow a user to join a room.
     * Verifies that a POST request to '/rooms/:roomId/join' with a player's token
     * successfully adds the player to the room with an 'ACTIVE' status.
     */
    it('should allow a user to join a room', async () => {
      // Attempt to join this room using the playerJoinAccessToken
      const joinRes = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`) // roomId is in the path
        .set('Authorization', `Bearer ${playerJoinAccessToken}`) // Player joins
        .expect(200); // Expect HTTP status 200 (OK)

      expect(joinRes.body).toHaveProperty('id'); // Expecting the updated room object
      // Verify the player is now in the room with ACTIVE status by querying the database directly.
      const roomPlayer = await dataSource.getRepository(RoomPlayer).findOne({
        where: { roomId, userId: playerJoinUserId },
      });
      expect(roomPlayer?.status).toBe(RoomPlayerStatus.ACTIVE);
    });

    /**
     * Test case: Should allow a user to leave a room.
     * Verifies that a POST request to '/rooms/:roomId/leave' with a player's token
     * updates the player's status to 'LEFT' in the room.
     */
    it('should allow a user to leave a room', async () => {
      // First, ensure the player is in the room with ACTIVE status before attempting to leave.
      await dataSource.getRepository(RoomPlayer).save({
        room: { id: roomId },
        player: { id: playerJoinUserId },
        status: RoomPlayerStatus.ACTIVE,
      });

      const leaveRes = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${playerJoinAccessToken}`) // Player leaves
        .expect(200); // Expect HTTP status 200 (OK)

      expect(leaveRes.body).toHaveProperty('id'); // Expecting the updated room object
      // Verify the player's status is now LEFT by querying the database directly.
      const roomPlayer = await dataSource.getRepository(RoomPlayer).findOne({
        where: { roomId, userId: playerJoinUserId },
      });
      expect(roomPlayer?.status).toBe(RoomPlayerStatus.LEFT);
    });
  });

  /**
   * Test suite for Room Management functionality (host-specific actions).
   */
  describe('Room Management', () => {
    let roomId: string; // ID of the room created for these tests

    /**
     * Setup for room management tests.
     * Registers and logs in a dedicated host user to perform management actions.
     */
    beforeAll(async () => {
      // Register and login a host user
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'hostuser_wr', password: 'Password123!' })
        .expect(201);

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'hostuser_wr', password: 'Password123!' })
        .expect(200);

      hostAccessToken = loginRes.body.access_token;
      const hostUser = await dataSource.getRepository(User).findOne({ where: { username: 'hostuser_wr' } });
      if (!hostUser) { // Add null check
        console.error('[E2E Setup] CRITICAL: User "hostuser_wr" not found after login attempt.');
        throw new Error('Test user "hostuser_wr" not found after login.');
      }
      hostUserId = hostUser.id;
    });

    /**
     * Creates a new private room with approval required before each test in this suite.
     * This room is used for testing host-specific management actions.
     */
    beforeEach(async () => {
      // Create a room by the host
      const createRoomDto = {
        name: 'Manageable Room',
        maxPlayers: 4,
        isPublic: false, // Make room private for approval flow
        approvalRequired: true, // Require approval for joining
      };
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(createRoomDto)
        .expect(201);
      roomId = response.body.id; // Store the created room's ID
    });

    /**
     * Test case: Should allow host to update room details.
     * Verifies that a PATCH request to '/rooms/:roomId' by the host
     * successfully updates the room's name and max players.
     */
    it('should allow host to update room details', async () => {
      const updateRoomDto = {
        name: 'Updated Room Name',
        maxPlayers: 6,
      };
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(updateRoomDto)
        .expect(200); // Expect HTTP status 200 (OK)

      expect(response.body.name).toBe(updateRoomDto.name);
      expect(response.body.maxPlayers).toBe(updateRoomDto.maxPlayers);
    });

    /**
     * Test case: Should allow host to delete a room.
     * Verifies that a DELETE request to '/rooms/:roomId' by the host
     * successfully removes the room from the database.
     */
    it('should allow host to delete a room', async () => {
      await request(app.getHttpServer())
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .expect(200); // Expect HTTP status 200 (OK)

      // Verify the room is no longer in the database by direct query.
      const room = await dataSource.getRepository(Room).findOne({ where: { id: roomId } });
      expect(room).toBeNull();
    });

    /**
     * Test case: Should allow host to respond to join requests (approve).
     * Simulates a player sending a join request to a private room,
     * and then verifies that the host can approve this request,
     * changing the player's status to 'ACTIVE'.
     */
    it('should allow host to respond to join requests', async () => {
      // Register and login a player user to send a join request.
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'playeruser_wr', password: 'Password123!' })
        .expect(201);

      const playerLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'playeruser_wr', password: 'Password123!' })
        .expect(200);
      const playerAccessToken = playerLoginRes.body.access_token;
      const playerUser = await dataSource.getRepository(User).findOne({ where: { username: 'playeruser_wr' } });
      if (!playerUser) {
        throw new Error('Player user not found after registration.');
      }
      const playerUserId = playerUser.id;

      // Player sends join request to the private room.
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${playerAccessToken}`)
        .send({}) // Empty body is fine for join request
        .expect(200); // Expect HTTP status 200 (OK) for pending request

      // Host accepts the join request.
      const respondDto = {
        decision: JoinRequestDecision.APPROVE,
      };
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/pending-requests/${playerUserId}/respond`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(respondDto)
        .expect(201); // Expect HTTP status 201 (Created) for successful response

      // Assert that the response body is a Room object and the player's status is updated to ACTIVE.
      expect(response.body).toHaveProperty('id');
      expect(response.body.roomPlayers).toBeInstanceOf(Array);
      const updatedRoomPlayer = response.body.roomPlayers.find(
        (rp: any) => rp.player.id === playerUserId,
      );
      expect(updatedRoomPlayer).toBeDefined();
      expect(updatedRoomPlayer.status).toBe(RoomPlayerStatus.ACTIVE);
    });

    /**
     * Test case: Should allow host to start the game.
     * Simulates a player joining and being accepted into a room,
     * then verifies that the host can start the game, changing the room status to 'IN_PROGRESS'.
     */
    it('should allow host to start game', async () => {
      // Register and login a second player user.
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'player2user_wr', password: 'Password123!' })
        .expect(201);

      const playerLoginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'player2user_wr', password: 'Password123!' })
        .expect(200);
      const playerAccessToken = playerLoginRes.body.access_token;
      const playerUser = await dataSource.getRepository(User).findOne({ where: { username: 'player2user_wr' } });
      if (!playerUser) {
        throw new Error('Player 2 user not found after registration.');
      }
      const playerUserId = playerUser.id;

      // Player joins the room (will be PENDING as approval is required).
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${playerAccessToken}`)
        .send({ roomId })
        .expect(200);

      // Manually update player status to ACTIVE to simulate host approval for game start.
      await dataSource.getRepository(RoomPlayer).update(
        { room: { id: roomId }, player: { id: playerUserId } },
        { status: RoomPlayerStatus.ACTIVE }
      );

      // Host starts the game.
      const startGameDto = {}; // Empty DTO for starting game
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send() // Send empty body
        .expect(201); // Expect HTTP status 201 (Created) for successful game start

      expect(response.body.status).toBe(RoomStatus.IN_PROGRESS); // Verify room status in response
      // Verify the room status is IN_PROGRESS in the database directly.
      const room = await dataSource.getRepository(Room).findOne({ where: { id: roomId } });
      expect(room?.status).toBe(RoomStatus.IN_PROGRESS);
    });
  });
});