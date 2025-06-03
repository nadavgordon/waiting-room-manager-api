import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { AppDataSource } from './data-source';

/**
 * Service responsible for managing database connections and ensuring proper cleanup
 * during application shutdown.
 * 
 * Implements OnModuleInit and OnModuleDestroy lifecycle hooks to properly initialize
 * and close database connections, preventing resource leaks during application
 * termination.
 */
@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  /**
   * Initializes the database connection when the module is initialized.
   * This is handled separately in main.ts with retry logic, so this method
   * primarily serves as a connection status verification.
   */
  async onModuleInit(): Promise<void> {
    if (!AppDataSource.isInitialized) {
      this.logger.warn(
        'Database connection not initialized. Initialization should be handled in main.ts before module initialization.',
      );
    } else {
      this.logger.log('Database connection is already initialized.');
    }
  }

  /**
   * Gracefully closes database connections when the application is shutting down.
   * This prevents connection leaks and ensures that in-flight database operations
   * can complete before termination.
   */
  async onModuleDestroy(): Promise<void> {
    // Add very visible logging for testing
    console.log('\n\n🔴 DATABASE SERVICE: onModuleDestroy TRIGGERED - GRACEFUL SHUTDOWN IN PROGRESS');
    this.logger.log('DATABASE SERVICE: Starting graceful shutdown of database connections');
    
    if (AppDataSource.isInitialized) {
      this.logger.log('Closing database connection...');
      
      try {
        await AppDataSource.destroy();
        console.log('✅ DATABASE CONNECTION CLOSED SUCCESSFULLY');
        this.logger.log('Database connection closed successfully.');
      } catch (error) {
        console.error('❌ ERROR CLOSING DATABASE CONNECTION', error);
        this.logger.error(
          'Error closing database connection',
          error instanceof Error ? error.stack : String(error),
        );
      }
    } else {
      this.logger.log('No database connection to close.');
    }
  }
}
