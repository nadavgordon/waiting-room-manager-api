import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(LoggerService));

  // JWT Secret validation at application startup
  const configService = app.get(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not defined. Please set a strong secret.');
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security reasons.');
  }

  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Configure CORS
  const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
  app.useLogger(app.get(LoggerService)); // Re-get logger to ensure it's initialized
  app.get(LoggerService).log(`CORS_ORIGINS configured: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : 'None (restrictive default)'}`, 'CORS');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips properties not defined in DTOs
      forbidNonWhitelisted: true, // Throws an error if non-whitelisted properties are present
      transform: true, // Automatically transforms payload to DTO instances
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Waiting Room Manager API')
    .setDescription('Comprehensive API for managing waiting rooms, user authentication, and real-time game interactions. Provides robust security, logging, and scalable architecture.')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'access-token', // This name is used to refer to this auth scheme in @ApiBearerAuth()
    )
    .addTag('Auth', 'User authentication and authorization endpoints')
    .addTag('User', 'User management endpoints')
    .addTag('WaitingRoom', 'Waiting room creation, management, and real-time interaction endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
