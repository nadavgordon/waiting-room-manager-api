import { DataSource } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { RoomPlayer } from '../waiting-room/entities/room-player.entity';
import { Room } from '../waiting-room/entities/room.entity';
import * as dotenv from 'dotenv';

dotenv.config();

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USERNAME:', process.env.DB_USERNAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '********' : 'undefined'); // Mask password for security
console.log('DB_DATABASE:', process.env.DB_DATABASE);

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [Room, User, RoomPlayer],
  migrations: ['src/db/migrations/*.ts'],
  synchronize: false,
});