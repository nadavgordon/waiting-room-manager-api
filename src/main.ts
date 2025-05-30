import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  // Initialize the NestJS application.
  // `bufferLogs: true` ensures that logs are collected before a custom logger is fully set up,
  // preventing early logs from being lost.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Integrate the custom LoggerService for structured and consistent logging across the application.
  app.useLogger(app.get(LoggerService));

  // Perform critical security validation for the JWT_SECRET environment variable.
  // This ensures that the application's authentication mechanism is securely configured at startup.
  const configService = app.get(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');

  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is not defined. Please set a strong secret.');
  }

  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security reasons.');
  }

  // Apply a global exception filter to standardize error responses.
  // The `AllExceptionsFilter` ensures that all unhandled exceptions are caught and
  // transformed into a consistent JSON error format, improving API reliability.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Configure Cross-Origin Resource Sharing (CORS) for frontend integration.
  // This controls which origins are allowed to make requests to the API, enhancing security.
  const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [];
  app.get(LoggerService).log(`CORS_ORIGINS configured: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : 'None (restrictive default)'}`, 'CORS');
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Enable global validation pipe for automatic DTO validation.
  // This pipe leverages `class-validator` and `class-transformer` to ensure incoming request
  // payloads conform to defined DTO schemas, improving data integrity and reducing boilerplate.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove properties not defined in DTOs.
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted properties are present.
      transform: true, // Transform incoming data to DTO class instances.
    }),
  );

  // Set up Swagger (OpenAPI) for API documentation and interactive exploration.
  // This provides a user-friendly interface to understand and test API endpoints.
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
      'access-token',
    )
    .addTag('Auth', 'User authentication and authorization endpoints')
    .addTag('User', 'User management endpoints')
    .addTag('WaitingRoom', 'Waiting room creation, management, and real-time interaction endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start the NestJS application, listening on the configured port.
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
