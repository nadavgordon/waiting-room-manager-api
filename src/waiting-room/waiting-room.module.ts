import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { RoomPlayer } from './entities/room-player.entity';
import { User } from '../user/entities/user.entity';
import { WaitingRoomService } from './waiting-room.service';
import { WaitingRoomController } from './waiting-room.controller';
import { WaitingRoomGateway } from './waiting-room.gateway';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    // Registers TypeORM entities (`Room`, `RoomPlayer`, `User`) for this module.
    // This makes their respective repositories available for dependency injection within `WaitingRoomModule`.
    TypeOrmModule.forFeature([Room, RoomPlayer, User]),
    LoggerModule, // Integrates the custom logging service for all waiting room related operations.
  ],
  controllers: [WaitingRoomController], // `WaitingRoomController` handles HTTP API requests related to rooms.
  providers: [WaitingRoomService, WaitingRoomGateway], // `WaitingRoomService` contains core business logic; `WaitingRoomGateway` manages WebSocket communication.
  exports: [WaitingRoomService], // Exports `WaitingRoomService` to allow other modules to interact with waiting room logic.
})
export class WaitingRoomModule {}
