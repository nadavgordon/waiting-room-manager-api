/**
 * @file global-teardown.ts
 * @description This file defines a global teardown script for Jest E2E tests.
 * It is responsible for cleaning up the database after all tests have been executed,
 * ensuring that the test environment is reset to a clean state.
 */
import { AppDataSource } from '../src/db/data-source';

export default async () => {
  // Add a small delay to allow other async operations (like afterEach cleanups) to complete
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Check if the TypeORM data source is initialized.
  if (AppDataSource.isInitialized) {
    // Drop the entire database to remove all test data and schema.
    await AppDataSource.dropDatabase();
    // Destroy the data source connection.
    await AppDataSource.destroy();
  }
};
