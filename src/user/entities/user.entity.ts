import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Room } from '../../waiting-room/entities/room.entity';
import { RoomPlayer } from '../../waiting-room/entities/room-player.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string; // Store hashed passwords

  @OneToMany(() => Room, room => room.host)
  hostedRooms: Room[];

  @OneToMany(() => RoomPlayer, roomPlayer => roomPlayer.player)
  roomPlayers: RoomPlayer[];
}