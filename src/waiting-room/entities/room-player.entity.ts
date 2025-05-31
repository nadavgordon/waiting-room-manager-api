import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Column,
} from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';
import { RoomPlayerStatus } from '../enums/room-player-status.enum';
import { ApiProperty } from '@nestjs/swagger';

@Entity('room_players')
export class RoomPlayer {
  @ApiProperty({
    description: 'Unique identifier of the room player entry',
    example: 'e1f2g3h4-i5j6-7890-1234-567890abcdef',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'ID of the room the player is associated with',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @Column()
  roomId: string;

  @ApiProperty({
    description: 'ID of the user who is a player in the room',
    example: 'b1c2d3e4-f5a6-7890-1234-567890abcdef',
  })
  @Column()
  userId: string;

  @ApiProperty({
    description: 'Current status of the player in the room',
    enum: RoomPlayerStatus,
    example: RoomPlayerStatus.ACTIVE,
  })
  @Column({
    type: 'varchar',
    enum: RoomPlayerStatus, // Use the imported enum
    default: RoomPlayerStatus.PENDING, // Default status for a new player
  })
  status: RoomPlayerStatus;

  @ApiProperty({
    type: () => Room,
    description: 'The room object the player is in',
  })
  @ManyToOne(() => Room, (room) => room.roomPlayers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ApiProperty({
    type: () => User,
    description: 'The user object representing the player',
  })
  @ManyToOne(() => User, (user) => user.roomPlayers)
  @JoinColumn({ name: 'userId' })
  player: User;
}
