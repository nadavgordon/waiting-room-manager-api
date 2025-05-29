import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { AppDataSource } from '../src/db/data-source';

export default async () => {
  dotenv.config({ path: resolve(__dirname, '../.env') });

  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  await AppDataSource.initialize();
  await AppDataSource.query(`DROP SCHEMA public CASCADE;`);
  await AppDataSource.query(`CREATE SCHEMA public;`);
  await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await AppDataSource.runMigrations();
};