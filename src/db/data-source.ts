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

/**
 * `AppDataSource` is the central TypeORM DataSource configuration for the application.
 * It defines the connection parameters to the PostgreSQL database, including connection pooling,
 * registers all TypeORM entities, and specifies the path for database migration files.
 *
 * This DataSource is primarily used by the TypeORM CLI for managing database schema
 * changes (migrations), ensuring a controlled and versioned approach to database evolution.
 * It loads environment variables using `dotenv` to configure database access securely.
 *
 * @property {string} type - Specifies the database type (PostgreSQL).
 * @property {number} poolSize - Configures the maximum number of connections in the connection pool.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  poolSize: 20, // Configure connection pooling
  entities: [Room, User, RoomPlayer], // All database entities managed by TypeORM.
  migrations: ['dist/db/migrations/*.js'], // Path to compiled migration files.
  synchronize: false, // Set to `false` in production to prevent data loss; migrations handle schema updates.
});
