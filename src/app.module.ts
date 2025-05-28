import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WaitingRoomModule } from './waiting-room/waiting-room.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'db/waiting_room.sqlite',
      autoLoadEntities: true,
      synchronize: true, // WARNING: Set to false in production
    }),
    WaitingRoomModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
