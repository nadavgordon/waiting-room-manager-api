import { Module, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from './database.service';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    // Initialization handled by DatabaseService
  }

  async onModuleDestroy() {
    // Ensure database connections are properly closed during shutdown
    await this.databaseService.onModuleDestroy();
  }
}
