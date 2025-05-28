import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WaitingRoomModule } from './waiting-room/waiting-room.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { User } from './user/entities/user.entity';
import { RoomPlayer } from './waiting-room/entities/room-player.entity';
import { Room } from './waiting-room/entities/room.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db/waiting_room.sqlite',
      entities: [Room, User, RoomPlayer],
      synchronize: true, // WARNING: Set to false in production
    }),
    WaitingRoomModule,
    UserModule,
    AuthModule,
    ConfigModule.forRoot({
      isGlobal: true, // Makes ConfigModule available globally
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
