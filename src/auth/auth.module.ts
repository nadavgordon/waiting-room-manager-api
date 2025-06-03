import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserModule } from '../user/user.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtBlacklistStrategy } from './jwt-blacklist.strategy';
import { JwtBlacklistGuard } from './jwt-blacklist.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from '../common/logger/logger.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    UserModule, // Provides `UserService` for user management, essential for authentication logic.
    PassportModule, // Integrates NestJS with Passport.js, a popular authentication middleware.
    // JwtModule.registerAsync: Configures the JWT module for token signing and verification.
    // It's configured asynchronously to allow injecting `ConfigService` for dynamic secret retrieval.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (
        configService: ConfigService,
      ): { secret: string; signOptions: { expiresIn: string } } => ({
        secret: configService.get<string>('JWT_SECRET') || 'development-secret', // JWT secret from environment variables or fallback for development
        signOptions: {
          expiresIn:
            configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION_TIME') ||
            '1h',
        }, // Token expiration time, enhancing security by limiting token validity.
      }),
      inject: [ConfigService],
    }),
    ConfigModule, // Ensures environment variables are accessible for JWT configuration.
    LoggerModule, // Provides structured logging capabilities for authentication events.
    TypeOrmModule.forFeature([User]),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    JwtBlacklistStrategy,
    JwtBlacklistGuard,
  ], // Core auth providers including strategies and guards
  controllers: [AuthController], // `AuthController` exposes authentication API endpoints.
  exports: [AuthService, JwtBlacklistGuard], // Export services and guards for use in other modules
})
export class AuthModule {}
