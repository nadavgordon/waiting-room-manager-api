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

describe('WaitingRoom (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;
  let hostAccessToken: string;
  let hostUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new (require('@nestjs/common').ValidationPipe)({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    dataSource = app.get(DataSource);

    // Register and login a user to get an access token
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'testuser_wr', password: 'Password123!' })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testuser_wr', password: 'Password123!' })
      .expect(200);

    accessToken = loginRes.body.access_token;
    const user = await dataSource.getRepository(User).findOne({ where: { username: 'testuser_wr' } });
    if (!user) { // Add null check and throw error if user not found
      console.error('[E2E Setup] CRITICAL: User "testuser_wr" not found after login attempt.');
      throw new Error('Test user "testuser_wr" not found after login.');
    }
    userId = user.id;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Clear tables before each test to ensure a clean state, respecting foreign key constraints
    // These are handled by global-setup and global-teardown for the entire test run.
    // Individual test cleanup will be handled by deleting specific entities created within tests.
  });

  describe('Room Creation', () => {
    it('should create a new waiting room', async () => {
      const createRoomDto = {
        name: 'Test Room',
        maxPlayers: 4,
      };

      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createRoomDto)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(createRoomDto.name);
      expect(response.body.maxPlayers).toBe(createRoomDto.maxPlayers);
      expect(response.body.host.id).toBe(userId);
    });

    it('should not create a room with invalid data', () => {
      return request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: '', maxPlayers: 0 })
        .expect(400);
    });
  });

  describe('Joining and Leaving Rooms', () => {
    let roomId: string;
    let playerJoinAccessToken: string;
    let playerJoinUserId: string;

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
      roomId = response.body.id;
    });

    it('should allow a user to join a room', async () => {
      // Attempt to join this room using the playerJoinAccessToken
      const joinRes = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`) // roomId is in the path
        .set('Authorization', `Bearer ${playerJoinAccessToken}`) // Player joins
        .expect(200);

      expect(joinRes.body).toHaveProperty('id');
      // Verify the player is now in the room
      const roomPlayer = await dataSource.getRepository(RoomPlayer).findOne({
        where: { roomId, userId: playerJoinUserId },
      });
      expect(roomPlayer?.status).toBe(RoomPlayerStatus.ACTIVE);
    });

    it('should allow a user to leave a room', async () => {
      // First, ensure the player is in the room
      await dataSource.getRepository(RoomPlayer).save({
        room: { id: roomId },
        player: { id: playerJoinUserId },
        status: RoomPlayerStatus.ACTIVE,
      });

      const leaveRes = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/leave`)
        .set('Authorization', `Bearer ${playerJoinAccessToken}`) // Player leaves
        .expect(200);

      expect(leaveRes.body).toHaveProperty('id'); // Expecting the updated room
      const roomPlayer = await dataSource.getRepository(RoomPlayer).findOne({
        where: { roomId, userId: playerJoinUserId },
      });
      expect(roomPlayer?.status).toBe(RoomPlayerStatus.LEFT);
    });
  });

  describe('Room Management', () => {
    let roomId: string;

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

    beforeEach(async () => {
      // Create a room by the host
      const createRoomDto = {
        name: 'Manageable Room',
        maxPlayers: 4,
        isPublic: false, // Make room private for approval flow
        approvalRequired: true,
      };
      const response = await request(app.getHttpServer())
        .post('/rooms')
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(createRoomDto)
        .expect(201);
      roomId = response.body.id;
    });

    it('should allow host to update room details', async () => {
      const updateRoomDto = {
        name: 'Updated Room Name',
        maxPlayers: 6,
      };
      const response = await request(app.getHttpServer())
        .patch(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(updateRoomDto)
        .expect(200);

      expect(response.body.name).toBe(updateRoomDto.name);
      expect(response.body.maxPlayers).toBe(updateRoomDto.maxPlayers);
    });

    it('should allow host to delete a room', async () => {
      await request(app.getHttpServer())
        .delete(`/rooms/${roomId}`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .expect(200);

      const room = await dataSource.getRepository(Room).findOne({ where: { id: roomId } });
      expect(room).toBeNull();
    });

    it('should allow host to respond to join requests', async () => {
      // Register and login a player user
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

      // Player sends join request
      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${playerAccessToken}`)
        .send({})
        .expect(200);

      // Host accepts join request
      const respondDto = {
        decision: JoinRequestDecision.APPROVE,
      };
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/pending-requests/${playerUserId}/respond`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send(respondDto)
        .expect(201);

      // Assert that the response body is a Room object and the player's status is updated
      expect(response.body).toHaveProperty('id');
      expect(response.body.roomPlayers).toBeInstanceOf(Array);
      const updatedRoomPlayer = response.body.roomPlayers.find(
        (rp: any) => rp.player.id === playerUserId,
      );
      expect(updatedRoomPlayer).toBeDefined();
      expect(updatedRoomPlayer.status).toBe(RoomPlayerStatus.ACTIVE);
    });

    it('should allow host to start game', async () => {
      // Player joins and is accepted
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

      await request(app.getHttpServer())
        .post(`/rooms/${roomId}/join`)
        .set('Authorization', `Bearer ${playerAccessToken}`)
        .send({ roomId })
        .expect(200);

      await dataSource.getRepository(RoomPlayer).update(
        { room: { id: roomId }, player: { id: playerUserId } },
        { status: RoomPlayerStatus.ACTIVE }
      );

      const startGameDto = {};
      const response = await request(app.getHttpServer())
        .post(`/rooms/${roomId}/start`)
        .set('Authorization', `Bearer ${hostAccessToken}`)
        .send()
        .expect(201);

      expect(response.body.status).toBe(RoomStatus.IN_PROGRESS);
      const room = await dataSource.getRepository(Room).findOne({ where: { id: roomId } });
      expect(room?.status).toBe(RoomStatus.IN_PROGRESS);
    });
  });
});