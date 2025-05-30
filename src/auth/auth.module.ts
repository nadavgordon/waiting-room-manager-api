import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    UserModule, // Provides `UserService` for user management, essential for authentication logic.
    PassportModule, // Integrates NestJS with Passport.js, a popular authentication middleware.
    // JwtModule.registerAsync: Configures the JWT module for token signing and verification.
    // It's configured asynchronously to allow injecting `ConfigService` for dynamic secret retrieval.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'), // JWT secret from environment variables for security.
        signOptions: { expiresIn: '60m' }, // Token expiration time, enhancing security by limiting token validity.
      }),
      inject: [ConfigService],
    }),
    ConfigModule, // Ensures environment variables are accessible for JWT configuration.
    LoggerModule, // Provides structured logging capabilities for authentication events.
  ],
  providers: [AuthService, JwtStrategy], // `AuthService` handles core auth logic; `JwtStrategy` defines JWT validation.
  controllers: [AuthController], // `AuthController` exposes authentication API endpoints.
  exports: [AuthService], // `AuthService` is exported to be used by other modules (e.g., by `JwtAuthGuard`).
})
export class AuthModule {}