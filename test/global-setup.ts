import * as dotenv from 'dotenv';
import { resolve } from 'path';

/**
 * @file global-setup.ts
 * @description This file defines a global setup script for Jest E2E tests.
 * It is responsible for configuring the test environment, specifically for database setup,
 * before any tests are executed. This ensures a clean and consistent database state for testing.
 */
export default async () => {
  // Override DB connection for Kind cluster testing BEFORE importing AppDataSource.
  // These environment variables are crucial for connecting to the PostgreSQL database
  // used during E2E tests.
  // The `DB_` prefixed variables are used by the application's TypeORM configuration
  // to connect to the database. They should match the `POSTGRES_` prefixed variables
  // that configure the PostgreSQL container itself (e.g., via Kubernetes secrets).
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  process.env.DB_USERNAME = 'testuser'; // Matches POSTGRES_USER in .env.example
  process.env.DB_PASSWORD = 'testpassword'; // Matches POSTGRES_PASSWORD in .env.example
  process.env.DB_DATABASE = 'waiting_room_db'; // Matches POSTGRES_DB in .env.example

  // Load .env after setting explicit overrides. This allows .env to potentially override
  // if desired, but the explicit settings above take precedence for Kind cluster testing.
  dotenv.config({ path: resolve(__dirname, '../.env') });

  // Import AppDataSource AFTER environment variables are set to ensure it picks up
  // the correct database configuration for the test environment.
  const { AppDataSource } = await import('../src/db/data-source');

  // Ensure the DataSource is initialized.
  if (!AppDataSource.isInitialized) {
    console.log('GlobalSetup: AppDataSource not initialized. Initializing...');
    await AppDataSource.initialize();
    console.log('GlobalSetup: AppDataSource initialized.');
  } else {
    console.log(
      'GlobalSetup: AppDataSource already initialized. Proceeding with schema reset.',
    );
  }
  // Drop the public schema to remove all existing tables and data, ensuring test isolation.
  await AppDataSource.query(`DROP SCHEMA public CASCADE;`);
  // Recreate the public schema.
  await AppDataSource.query(`CREATE SCHEMA public;`);
  // Create the uuid-ossp extension, which is required for UUID generation in PostgreSQL.
  await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  // Run all pending TypeORM migrations to set up the database schema for tests.
  await AppDataSource.runMigrations();
};
