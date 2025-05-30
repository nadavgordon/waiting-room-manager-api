import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';

@Module({
  // `LoggerModule` provides the `LoggerService` to the rest of the application.
  // By listing `LoggerService` in both `providers` and `exports`, it ensures that
  // any module importing `LoggerModule` can inject and utilize the custom logger.
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}