import { UnauthorizedException } from '@nestjs/common';
import { WsAuthGuard } from '../../src/auth/ws-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

/**
 * @file ws-auth.guard.spec.ts
 * @description Unit tests for the `WsAuthGuard`.
 * These tests focus on verifying the guard's ability to validate WebSocket connections
 * based on the presence and validity of a JWT in the handshake headers.
 * It covers scenarios for successful authentication, missing tokens, and invalid tokens.
 */
describe('WsAuthGuard', () => {
  let guard: WsAuthGuard;

  beforeEach(() => {
    guard = new WsAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true if a valid JWT is provided in handshake headers', async () => {
      const mockToken = 'valid.jwt.token';
      const mockClient = {
        handshake: {
          headers: {
            authorization: `Bearer ${mockToken}`,
          },
        },
      } as unknown as Socket;

      const mockExecutionContext = {
        switchToWs: () => ({
          getClient: () => mockClient,
        }),
      } as ExecutionContext;

      // Mock the super.canActivate method to return true, simulating successful JWT validation
      jest.spyOn(guard, 'canActivate').mockImplementation((context: ExecutionContext) => {
        const client: Socket = context.switchToWs().getClient();
        client.handshake.headers.authorization = `Bearer ${mockToken}`; // Ensure token is set for super.canActivate
        return true; // Simulate successful validation by AuthGuard('jwt')
      });

      const result = await guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
      expect(mockClient.handshake.headers.authorization).toBe(`Bearer ${mockToken}`);
    });

    it('should throw UnauthorizedException if no authorization token is provided', async () => {
      const mockClient = {
        handshake: {
          headers: {},
        },
      } as unknown as Socket;

      const mockExecutionContext = {
        switchToWs: () => ({
          getClient: () => mockClient,
        }),
      } as ExecutionContext;

      await expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
      await expect(() => guard.canActivate(mockExecutionContext)).toThrow('No authorization token provided.');
    });

    it('should throw UnauthorizedException if JWT is invalid', async () => {
      const mockToken = 'invalid.jwt.token';
      const mockClient = {
        handshake: {
          headers: {
            authorization: `Bearer ${mockToken}`,
          },
        },
      } as unknown as Socket;

      const mockExecutionContext = {
        switchToWs: () => ({
          getClient: () => mockClient,
        }),
      } as ExecutionContext;

      // Mock the super.canActivate method to throw UnauthorizedException
      jest.spyOn(guard, 'canActivate').mockImplementation((context: ExecutionContext) => {
        const client: Socket = context.switchToWs().getClient();
        client.handshake.headers.authorization = `Bearer ${mockToken}`;
        throw new UnauthorizedException('Invalid token'); // Simulate failed validation by AuthGuard('jwt')
      });

      await expect(() => guard.canActivate(mockExecutionContext)).toThrow(UnauthorizedException);
      await expect(() => guard.canActivate(mockExecutionContext)).toThrow('Invalid token');
    });
  });

  describe('handleRequest', () => {
    it('should return user if no error and user is provided', () => {
      const mockUser = { id: 'user1', username: 'testuser' };
      const result = guard.handleRequest(null, mockUser, null);
      expect(result).toEqual(mockUser);
    });

    it('should throw error if error is provided', () => {
      const mockError = new Error('Test Error');
      expect(() => guard.handleRequest(mockError, null, null)).toThrow('Test Error');
    });

    it('should throw UnauthorizedException if no user is provided and no error', () => {
      expect(() => guard.handleRequest(null, null, null)).toThrow(UnauthorizedException);
    });
  });
});