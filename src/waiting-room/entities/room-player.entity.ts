import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Column } from 'typeorm';
import { Room } from './room.entity';
import { User } from '../../user/entities/user.entity';
import { RoomPlayerStatus } from '../enums/room-player-status.enum';

@Entity('room_players')
export class RoomPlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roomId: string;

  @Column()
  userId: string;

  @Column({
    type: 'varchar',
    enum: RoomPlayerStatus, // Use the imported enum
    default: RoomPlayerStatus.PENDING, // Default status for a new player
  })
  status: RoomPlayerStatus;

  @ManyToOne(() => Room, room => room.roomPlayers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'roomId' })
  room: Room;

  @ManyToOne(() => User, user => user.roomPlayers)
  @JoinColumn({ name: 'userId' })
  player: User;
}