import * as dotenv from 'dotenv';
import { resolve } from 'path';

export default async () => {
  // Override DB connection for Kind cluster testing BEFORE importing AppDataSource
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  // Ensure these match your Kind cluster's PostgreSQL secret values
  process.env.DB_USERNAME = 'postgres';
  process.env.DB_PASSWORD = 'your_db_password';
  process.env.DB_DATABASE = 'your_db_database';

  // Load .env after setting overrides, to allow .env to potentially override if desired,
  // but our explicit settings above take precedence for Kind testing.
  dotenv.config({ path: resolve(__dirname, '../.env') });

  // Import AppDataSource AFTER environment variables are set
  const { AppDataSource } = await import('../src/db/data-source');

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  await AppDataSource.initialize();
  await AppDataSource.query(`DROP SCHEMA public CASCADE;`);
  await AppDataSource.query(`CREATE SCHEMA public;`);
  await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await AppDataSource.runMigrations();
};