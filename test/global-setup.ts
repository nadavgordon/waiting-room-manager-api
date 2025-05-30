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
  process.env.DB_HOST = 'localhost';
  process.env.DB_PORT = '5432';
  // Ensure these match your Kind cluster's PostgreSQL secret values.
  // In a real CI/CD environment, these would be securely managed.
  process.env.DB_USERNAME = 'postgres';
  process.env.DB_PASSWORD = 'your_db_password'; // Placeholder: Replace with actual test DB password
  process.env.DB_DATABASE = 'your_db_database'; // Placeholder: Replace with actual test DB name

  // Load .env after setting explicit overrides. This allows .env to potentially override
  // if desired, but the explicit settings above take precedence for Kind cluster testing.
  dotenv.config({ path: resolve(__dirname, '../.env') });

  // Import AppDataSource AFTER environment variables are set to ensure it picks up
  // the correct database configuration for the test environment.
  const { AppDataSource } = await import('../src/db/data-source');

  // If the data source is already initialized (e.g., from a previous test run in watch mode),
  // destroy it to ensure a clean slate.
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  // Initialize the TypeORM data source. This connects to the database.
  await AppDataSource.initialize();
  // Drop the public schema to remove all existing tables and data, ensuring test isolation.
  await AppDataSource.query(`DROP SCHEMA public CASCADE;`);
  // Recreate the public schema.
  await AppDataSource.query(`CREATE SCHEMA public;`);
  // Create the uuid-ossp extension, which is required for UUID generation in PostgreSQL.
  await AppDataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  // Run all pending TypeORM migrations to set up the database schema for tests.
  await AppDataSource.runMigrations();
};