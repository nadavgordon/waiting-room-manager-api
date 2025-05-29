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
  imports: [TypeOrmModule.forFeature([Room, RoomPlayer, User]), LoggerModule],
  controllers: [WaitingRoomController],
  providers: [WaitingRoomService, WaitingRoomGateway],
  exports: [WaitingRoomService], // Export if other modules need direct access
})
export class WaitingRoomModule {}
