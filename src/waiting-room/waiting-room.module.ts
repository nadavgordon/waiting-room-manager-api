import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Room } from './entities/room.entity';
import { WaitingRoomService } from './waiting-room.service';
import { WaitingRoomController } from './waiting-room.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Room])],
  controllers: [WaitingRoomController],
  providers: [WaitingRoomService],
  exports: [WaitingRoomService], // Export if other modules need direct access
})
export class WaitingRoomModule {}
