import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Room } from '../../waiting-room/entities/room.entity';
import { RoomPlayer } from '../../waiting-room/entities/room-player.entity';
import { ApiProperty } from '@nestjs/swagger';

@Entity('users')
export class User {
  @ApiProperty({ description: 'Unique identifier of the user', example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: 'Unique username of the user', example: 'john_doe' })
  @Column({ unique: true })
  username: string;

  @Column()
  passwordHash: string; // Stores the securely hashed password.

  @ApiProperty({ description: 'Timestamp when the user account was created', example: '2023-01-01T12:00:00Z' })
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the user account was last updated', example: '2023-01-01T12:00:00Z' })
  @UpdateDateColumn()
  updatedAt: Date;

  // Establishes a one-to-many relationship: one user can host multiple rooms.
  // `room => room.host` defines the inverse side of the relationship in the `Room` entity.
  @OneToMany(() => Room, room => room.host)
  hostedRooms: Room[];

  // Establishes a one-to-many relationship: one user can be a player in multiple rooms.
  // This relationship is managed through the `RoomPlayer` entity, which links users to specific rooms.
  @OneToMany(() => RoomPlayer, roomPlayer => roomPlayer.player)
  roomPlayers: RoomPlayer[];
}