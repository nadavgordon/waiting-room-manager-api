import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { RoomPlayer } from './room-player.entity';
import { User } from '../../user/entities/user.entity';
import { ApiProperty } from '@nestjs/swagger';

export enum RoomStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in-progress',
  FINISHED = 'finished',
}

@Entity('rooms') // Specifies the table name in the database
export class Room {
  @ApiProperty({
    description: 'Unique identifier of the room',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'The name of the waiting room',
    example: 'My Awesome Room',
  })
  @Column({
    type: 'varchar',
    length: 255,
  })
  name: string;

  @ApiProperty({
    description: 'Whether the room is public or private',
    example: true,
  })
  @Column({
    type: 'boolean',
    default: true, // Rooms are public by default
  })
  isPublic: boolean;

  @ApiProperty({
    description:
      'Whether join requests require host approval (applies to private rooms)',
    example: false,
  })
  @Column({
    type: 'boolean',
    default: false, // Rooms do not require approval by default
  })
  approvalRequired: boolean;

  @ApiProperty({
    description: 'Maximum number of players allowed in the room',
    example: 8,
  })
  @Column({
    type: 'int',
    default: 8, // Default max players
  })
  maxPlayers: number;

  @ApiProperty({
    type: () => [RoomPlayer],
    description: 'List of players currently in the room',
  })
  @OneToMany(() => RoomPlayer, (roomPlayer) => roomPlayer.room)
  roomPlayers: RoomPlayer[];

  // For pending requests, we can add a status to RoomPlayer or a separate entity if needed.
  // For now, we'll assume pending requests are also handled via RoomPlayer with a status.

  @ApiProperty({
    description: 'Current status of the room',
    enum: RoomStatus,
    example: RoomStatus.WAITING,
  })
  @Column({
    type: 'varchar', // Changed from 'enum' for SQLite compatibility
    enum: RoomStatus, // Still useful for validation and type safety in code
    default: RoomStatus.WAITING,
  })
  status: RoomStatus;

  @ApiProperty({
    description: 'ID of the user who created and hosts the room',
    example: 'b1c2d3e4-f5a6-7890-1234-567890abcdef',
  })
  @Column({ nullable: false })
  hostId: string; // Foreign key for the host user

  @ApiProperty({ type: () => User, description: 'The host user object' })
  @ManyToOne(() => User, (user) => user.hostedRooms)
  @JoinColumn({ name: 'hostId' })
  host: User;

  @ApiProperty({
    description: 'Timestamp when the room was created',
    example: '2023-01-01T12:00:00Z',
  })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the room was last updated',
    example: '2023-01-01T12:00:00Z',
  })
  @UpdateDateColumn()
  updatedAt: Date;
}
