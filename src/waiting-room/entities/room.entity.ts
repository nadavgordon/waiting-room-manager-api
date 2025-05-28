import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { RoomPlayer } from './room-player.entity';
import { User } from '../../user/entities/user.entity';

export enum RoomStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in-progress',
  FINISHED = 'finished',
}

@Entity('rooms') // Specifies the table name in the database
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @Column({
    type: 'boolean',
    default: true, // Rooms are public by default
  })
  isPublic: boolean;

  @Column({
    type: 'boolean',
    default: false, // Rooms do not require approval by default
  })
  approvalRequired: boolean;

  @Column({
    type: 'int',
    default: 8, // Default max players
  })
  maxPlayers: number;

  @OneToMany(() => RoomPlayer, roomPlayer => roomPlayer.room)
  roomPlayers: RoomPlayer[];

  // For pending requests, we can add a status to RoomPlayer or a separate entity if needed.
  // For now, we'll assume pending requests are also handled via RoomPlayer with a status.

  @Column({
    type: 'varchar', // Changed from 'enum' for SQLite compatibility
    enum: RoomStatus, // Still useful for validation and type safety in code
    default: RoomStatus.WAITING,
  })
  status: RoomStatus;

  @Column({ nullable: false })
  hostId: string; // Foreign key for the host user

  @ManyToOne(() => User, user => user.hostedRooms)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
