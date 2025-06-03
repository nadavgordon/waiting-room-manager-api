import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggerService } from './common/logger/logger.service';
import helmet from 'helmet';
import { AppDataSource } from './db/data-source'; // Import AppDataSource

// Function to initialize DataSource with retry logic
async function initializeDataSourceWithRetry(
  logger: LoggerService,
  maxRetries = 5,
  initialDelay = 2000, // 2 seconds
) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      logger.log('Attempting to connect to the database...', 'DataSource');
      await AppDataSource.initialize();
      logger.log('Database connection established successfully.', 'DataSource');
      return; // Success
    } catch (error) {
      retries++;
      const delay = initialDelay * Math.pow(2, retries - 1); // Exponential backoff
      logger.error(
        `Database connection failed (attempt ${retries}/${maxRetries}). Retrying in ${delay / 1000}s...`,
        error instanceof Error ? error.stack : String(error),
        'DataSource',
      );
      if (retries >= maxRetries) {
        logger.error(
          'Max retries reached. Could not connect to the database.',
          error instanceof Error ? error.stack : String(error),
          'DataSource',
        );
        throw error; // Re-throw the error to stop the application
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function bootstrap() {
  // Initialize the NestJS application.
  // `bufferLogs: true` ensures that logs are collected before a custom logger is fully set up,
  // preventing early logs from being lost.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  
  // Enable shutdown hooks to ensure graceful application shutdown
  // This allows the application to close connections, finish requests,
  // and clean up resources before terminating
  app.enableShutdownHooks();

  // Integrate the custom LoggerService for structured and consistent logging across the application.
  const logger = app.get(LoggerService);
  app.useLogger(logger);

  // Initialize DataSource with retry logic before proceeding
  try {
    await initializeDataSourceWithRetry(logger);
  } catch (error) {
    logger.error(
      'Application startup failed due to database connection issues. Exiting.',
      error instanceof Error ? error.stack : String(error),
      'Bootstrap',
    );
    process.exit(1); // Exit if DB connection fails after retries
  }

  // Perform critical security validation for the JWT_SECRET environment variable.
  // This ensures that the application's authentication mechanism is securely configured at startup.
  const configService = app.get(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');

  if (!jwtSecret) {
    throw new Error(
      'JWT_SECRET environment variable is not defined. Please set a strong secret.',
    );
  }

  if (jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET must be at least 32 characters long for security reasons.',
    );
  }

  // Apply a global exception filter to standardize error responses.
  // The `AllExceptionsFilter` ensures that all unhandled exceptions are caught and
  // transformed into a consistent JSON error format, improving API reliability.
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));

  // Configure Cross-Origin Resource Sharing (CORS) for frontend integration.
  // This controls which origins are allowed to make requests to the API, enhancing security.
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [];
  app
    .get(LoggerService)
    .log(
      `CORS_ORIGINS configured: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : 'None (restrictive default)'}`,
      'CORS',
    );
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Apply Helmet middleware for enhanced application security by setting various HTTP headers.
  // This helps protect against common web vulnerabilities like XSS, clickjacking, and others.
  app.use(helmet());

  // Configure Content Security Policy (CSP) to mitigate cross-site scripting (XSS) attacks
  // and other content injection vulnerabilities. This policy defines approved sources of content.
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"], // Only allow resources from the same origin by default.
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow self, inline scripts, and eval for development/Swagger.
        styleSrc: ["'self'", "'unsafe-inline'"], // Allow self and inline styles.
        imgSrc: ["'self'", 'data:'], // Allow images from self and data URIs.
        fontSrc: ["'self'"], // Allow fonts from self.
        connectSrc: ["'self'", 'https://ka-f.fontawesome.com'], // Allow connections to self and FontAwesome CDN.
        objectSrc: ["'none'"], // Disallow <object>, <embed>, and <applet> elements.
        mediaSrc: ["'self'"], // Allow media from self.
        frameSrc: ["'none'"], // Disallow embedding the application in iframes.
      },
    }),
  );

  // Add X-Content-Type-Options header to prevent MIME sniffing.
  // This ensures that browsers interpret content types as declared, reducing exposure to drive-by downloads.
  app.use(helmet.noSniff());

  // Add X-Frame-Options header to prevent clickjacking attacks.
  // 'DENY' prevents the page from being rendered in a frame.
  app.use(helmet.frameguard({ action: 'deny' }));

  // Add Strict-Transport-Security (HSTS) header to enforce secure (HTTPS) connections.
  // 'max-age' specifies the duration in seconds that the browser should remember to
  // only access the site using HTTPS. 'includeSubDomains' applies the policy to subdomains.
  app.use(
    helmet.hsts({
      maxAge: 31536000, // 1 year in seconds.
      includeSubDomains: true,
      preload: true, // Opt-in to browser HSTS preload list.
    }),
  );

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
    .setDescription(
      'Comprehensive API for managing waiting rooms, user authentication, and real-time game interactions. Provides robust security, logging, and scalable architecture.',
    )
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
    .addTag(
      'WaitingRoom',
      'Waiting room creation, management, and real-time interaction endpoints',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Start the NestJS application, listening on the configured port.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap().catch((err) => {
  console.error(
    'Failed to start application:',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
