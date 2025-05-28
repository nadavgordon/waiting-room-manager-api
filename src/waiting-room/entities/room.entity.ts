import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
    type: 'int',
    default: 8, // Default max players
  })
  maxPlayers: number;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.WAITING,
  })
  status: RoomStatus;

  @Column({
    type: 'varchar', // Assuming hostId is a string, e.g., a user's UUID
    nullable: false, // A room must have a host
  })
  hostId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
