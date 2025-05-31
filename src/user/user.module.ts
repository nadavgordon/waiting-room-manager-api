import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    // `TypeOrmModule.forFeature()` registers the `User` entity for this module,
    // making its repository available for injection (e.g., into `UserService`).
    TypeOrmModule.forFeature([User]),
    LoggerModule, // Integrates the custom logging service for user-related operations.
  ],
  providers: [UserService], // `UserService` encapsulates the business logic for user management.
  controllers: [UserController], // `UserController` exposes API endpoints for user profiles.
  exports: [UserService], // Exports `UserService` to allow other modules (like `AuthModule`) to use it.
})
export class UserModule {}
