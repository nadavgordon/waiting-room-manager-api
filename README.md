<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Waiting Room Manager API

## Project Overview
This project implements a robust and scalable API for managing multiplayer game waiting rooms. It provides comprehensive features for user authentication, room management, and real-time communication, ensuring a seamless experience for players. The API is built with a focus on security, performance, and ease of deployment.

## Features
- **User Authentication**: Register and log in users using JWT.
- **Room Management**:
  - Create new waiting rooms with customizable settings (public/private, approval required, player limits).
  - List available rooms, filtered by public status or user association.
  - Join existing rooms (with pending requests for private rooms).
  - Approve or decline join requests (for room hosts).
  - Leave rooms or cancel pending join requests.
  - Start games (only by room host, with player count validation).
  - Delete rooms (only by room host).
- **Database Management**: Utilizes TypeORM with PostgreSQL for managing `Room`, `User`, and `RoomPlayer` entities, with migrations for schema control.
- **Real-time Communication**: WebSocket integration for instant updates on room status and player changes.
- **Containerization**: Docker setup for easy deployment.
- **API Documentation**: Swagger/OpenAPI for interactive API exploration.
- **Global Exception Handling**: Centralized error handling for consistent API responses.

## Technologies Used
- **Backend**: NestJS (Node.js, TypeScript)
- **Database**: TypeORM with PostgreSQL
- **Authentication**: JWT (JSON Web Tokens), Passport.js, bcrypt
- **Validation**: Class-validator, Class-transformer
- **Containerization**: Docker
- **API Documentation**: Swagger (OpenAPI)
- **Real-time Communication**: WebSockets, Socket.IO
- **Caching**: Redis
- **Logging**: Winston

## Setup

### Prerequisites
- Node.js (v18 or higher)
- npm
- Docker (optional, for containerized setup)

### Local Development Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/waiting-room-manager-api.git
    cd waiting-room-manager-api
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the project root and populate it with the necessary environment variables. A `.env.example` file is provided for reference.

    ```
    PORT=3000
    JWT_SECRET=_your_super_secret_jwt_key_here_ # IMPORTANT: Change this in production! Use a strong, random string of at least 32 characters. You can generate one using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

    # Database (PostgreSQL) Configuration
    DB_TYPE=postgres
    DB_HOST=db
    DB_PORT=5432
    DB_USERNAME=testuser
    DB_PASSWORD=testpassword
    DB_DATABASE=waiting_room_db

    # PostgreSQL service credentials (used by the 'db' service in docker-compose)
    POSTGRES_USER=testuser
    POSTGRES_PASSWORD=testpassword
    POSTGRES_DB=waiting_room_db

    # Logging Configuration
    LOG_LEVEL=info # Set to error, warn, info, debug, or verbose. Default is info.

    # Redis Cache Configuration
    REDIS_HOST=cache
    REDIS_PORT=6379
    REDIS_PASSWORD= # Optional: Set if your Redis instance requires a password
    REDIS_TTL=3600 # Cache TTL in seconds (e.g., 1 hour)
    ```

    **Important Notes on Environment Variables:**
    *   **`JWT_SECRET`**: Crucial for signing and verifying JWTs. Ensure it's a strong, random string (at least 32 characters). The application includes a startup check in `src/main.ts` to enforce a minimum length. Never hardcode this in your source code.
    *   **`CORS_ORIGINS`**: Configure this with a comma-separated list of allowed frontend URLs (e.g., `http://localhost:3001,https://your-frontend-domain.com`). If not set, CORS will be restrictive by default.
    *   **Database Variables**: Ensure `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE` match your PostgreSQL setup.
    *   **Redis Variables**: Configure `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (if applicable), and `REDIS_TTL` for caching.
    *   **`LOG_LEVEL`**: Adjust this to control the verbosity of application logs.

## Security Enhancements

### Password Policy
To enhance user account security, the API enforces a strong password policy for user registration and password updates. Passwords must adhere to the following complexity requirements:

*   Minimum length of 8 characters.
*   Maximum length of 12 characters.
*   At least one uppercase letter (A-Z).
*   At least one lowercase letter (a-z).
*   At least one number (0-9).
*   At least one special character (e.g., `!@#$%^&*()_+-=[]{};':"\|,<.>/?`).

These rules are enforced using `@Matches` decorator from `class-validator` in the relevant DTOs (e.g., `src/user/dto/create-user.dto.ts`).

4.  **Database Setup:**
    The application now uses PostgreSQL. TypeORM migrations are used to manage the database schema.

    **PostgreSQL Configuration:**
    Ensure your PostgreSQL server is running and accessible. The connection details are configured via environment variables.

    **TypeORM Migrations:**
    For production readiness, `synchronize` is set to `false`. Database schema changes should be managed through TypeORM migrations.

    *   **Generate a new migration:**
        ```bash
        npm run typeorm:migration:generate <MigrationName>
        ```
        Replace `<MigrationName>` with a descriptive name for your migration (e.g., `InitialSchema`, `AddUserTable`). This command will create a new migration file in `src/db/migrations`.

    *   **Run pending migrations:**
        ```bash
        npm run typeorm:migration:run
        ```
        This command will execute all pending migrations, updating your database schema.

    *   **Revert the last migration:**
        ```bash
        npm run typeorm:migration:revert
        ```
        Use this command with caution, as it will revert the last applied migration.

## Running the Application

### Development Mode
```bash
npm run start:dev
```
The API will be accessible at `http://localhost:3000`.
Swagger API documentation will be available at `http://localhost:3000/api`.

### Production Mode
```bash
npm run build
npm run start:prod
```

### Running with Docker
This section outlines how to run the application using Docker.

#### Docker Image (Single Container)
1.  **Build the Docker image:**
    ```bash
    docker build -t waiting-room-api .
    ```
2.  **Run the Docker container:**
    ```bash
    docker run -p 3000:3000 --env-file ./.env waiting-room-api
    ```
    The `--env-file ./.env` flag passes your local `.env` variables into the container.

#### Docker Compose Setup (Multi-service Environment)
For local development with all services (API, PostgreSQL, Redis) running in Docker containers, use Docker Compose.

1.  **Ensure `.env` file is configured:**
    Make sure you have a `.env` file at the project root with all necessary environment variables as specified in `.env.example`.

2.  **Start the environment:**
    This command builds the `api` service image (if not already built) and starts all defined services in detached mode.
    ```bash
    docker-compose up -d
    ```

3.  **Stop the environment:**
    This command stops and removes all containers, networks, and volumes created by `docker-compose up`.
    ```bash
    docker-compose down
    ```

4.  **View logs for a specific service (e.g., `api`):**
    ```bash
    docker-compose logs -f api
    ```
    Replace `api` with `db` or `cache` to view logs for other services.

5.  **Rebuild and restart services (after code changes or `Dockerfile` updates):**
    ```bash
    docker-compose up -d --build
    ```

6.  **Accessing services:**
    *   API: `http://localhost:3000`
    *   PostgreSQL: Accessible from the `api` service via hostname `db` on port `5432`.
    *   Redis: Accessible from the `api` service via hostname `cache` on port `6379`.

## Redis Caching (Optional)
The API integrates Redis for caching frequently accessed data, improving response times and reducing database load.

### Configuration
Redis caching is configured via environment variables in your `.env` file:

-   `REDIS_HOST`: The hostname or IP address of your Redis server (e.g., `localhost`, `127.0.0.1`).
-   `REDIS_PORT`: The port number of your Redis server (e.g., `6379`).
-   `REDIS_PASSWORD`: (Optional) The password for your Redis server, if authentication is required.
-   `REDIS_TTL`: The default time-to-live (TTL) for cached items in seconds (e.g., `3600` for 1 hour).

**Example `.env` configuration:**
```
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TTL=3600
```

### Cached Endpoints/Methods
Currently, the following service method is cached:
-   `WaitingRoomService.findRoomById(id: string)`: Fetches room details by ID. This endpoint is frequently accessed and its data is relatively static unless a room is updated.

### Cache Invalidation Considerations
For cached data to remain consistent, appropriate cache invalidation strategies are crucial. While full implementation of complex invalidation is beyond the scope of this optional step, the following considerations are in place:
-   **Direct Invalidation on Write Operations**: The cache for a specific room (`room_<id>`) is explicitly invalidated (deleted) whenever a room is updated, deleted, a player joins, leaves, or a join request is approved/declined, or a game starts. This ensures that subsequent reads fetch the most up-to-date data from the database.
-   **TTL-based Expiration**: Cached items automatically expire after the `REDIS_TTL` duration, ensuring stale data is eventually removed.

## Logging
The application uses `winston` for comprehensive logging, configured to output structured JSON logs to the console.

### Configuration
Logging behavior can be controlled via environment variables in your `.env` file:

-   `LOG_LEVEL`: Sets the minimum level of messages to log.
    -   **Available Levels**: `error`, `warn`, `info`, `debug`, `verbose`
    -   **Default**: `info`
    -   **Example**: `LOG_LEVEL=debug` will show debug, info, warn, and error messages.

### Viewing Logs
Logs are output to the standard output (console). In a production environment, these logs can be easily collected by log management systems (e.g., ELK stack, Splunk, CloudWatch Logs) due to their structured JSON format.

### Contextual Logging
Key services and controllers include contextual information in logs (e.g., method name, user ID, request ID) to aid in debugging and tracing.

## API Endpoints

All API endpoints are prefixed with `/api`.

### Authentication
-   `POST /auth/register`: Register a new user.
-   `POST /auth/login`: Log in a user and receive a JWT.

*Note*: Most API endpoints require a valid JWT in the `Authorization: Bearer <token>` header.

### Rooms
-   `POST /rooms`: Create a new room. (Authenticated)
-   `GET /rooms`: Get a list of rooms. (Authenticated, filters by public/private and user association)
-   `GET /rooms/:id`: Get details of a specific room.
-   `PATCH /rooms/:id`: Update a room. (Authenticated, host only)
-   `DELETE /rooms/:id`: Delete a room. (Authenticated, host only)
-   `POST /rooms/:roomId/join`: Join a room. (Authenticated)
-   `POST /rooms/:roomId/pending-requests/:pendingUserId/respond`: Approve or decline a join request. (Authenticated, host only)
-   `POST /rooms/:roomId/leave`: Leave a room. (Authenticated)
-   `POST /rooms/:roomId/start`: Start a game in a room. (Authenticated, host only)

## Tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov

### End-to-end Tests with Coverage

To run the end-to-end tests and generate a coverage report:

```bash
npm run test:e2e -- --coverage
```
The coverage report will be available in the `coverage/` directory.

### Test Database Setup (for E2E Tests)

The end-to-end tests require a running PostgreSQL instance configured as per the `.env` file. The test environment automatically handles the creation of a test schema, running migrations, and cleaning up the database before and after the test suite execution via `test/global-setup.ts` and `test/global-teardown.ts`.
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Kubernetes Local Development with Kind

This section outlines how to set up and run the Waiting Room Manager API on a local Kubernetes cluster using Kind (Kubernetes in Docker).

### Prerequisites

*   **Docker**: Required for Kind to run Kubernetes nodes as Docker containers.
*   **Kind**: A tool for running local Kubernetes clusters using Docker container "nodes".
    *   Installation: Follow the official Kind documentation: [https://kind.sigs.k8s.io/docs/user/quick-start/#installation](https://kind.sigs.k8s.io/docs/user/quick-start/#installation)
*   **kubectl**: The Kubernetes command-line tool for running commands against Kubernetes clusters.
    *   Installation: Follow the official kubectl documentation: [https://kubernetes.io/docs/tasks/tools/install-kubectl/](https://kubernetes.io/docs/tasks/tools/install-kubectl/)

### Setup and Usage

1.  **Create a local Kind cluster:**
    ```bash
    kind create cluster --name waiting-room-dev
    ```

2.  **Build the API Docker image locally:**
    Ensure you are in the project root directory.
    ```bash
    docker build -t waiting-room-api:local .
    ```

3.  **Load the API Docker image into the Kind cluster:**
    This makes the locally built image available to the Kind cluster nodes.
    ```bash
    kind load docker-image waiting-room-api:local --name waiting-room-dev
    ```

4.  **Create Kubernetes Secrets:**
    The application requires secrets for `JWT_SECRET`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_DATABASE`. **Do not commit actual secret values to version control.**
    You can create these secrets using `kubectl`:

    ```bash
    kubectl create secret generic api-secret \
      --from-literal=JWT_SECRET='your_super_secret_jwt_key_here' \
      --from-literal=DB_USERNAME='your_db_username' \
      --from-literal=DB_PASSWORD='your_db_password' \
      --from-literal=DB_DATABASE='your_db_database'
    ```
    Replace the placeholder values with your actual secrets.

5.  **Apply all Kubernetes manifests:**
    Navigate to the project root and apply the manifests located in the `k8s/` directory.
    ```bash
    kubectl apply -f k8s/
    ```
    This command will deploy the API, PostgreSQL, and Redis services and deployments/statefulsets, along with the ConfigMap.

6.  **Verify Pods and Services:**
    Check the status of your deployed pods and services:
    ```bash
    kubectl get pods
    kubectl get svc
    ```

7.  **Access the API:**
    To access the API from your local machine, use port-forwarding:
    ```bash
    kubectl port-forward svc/api-service 3000:3000
    ```
    The API will then be accessible at `http://localhost:3000`.

8.  **View Logs:**
    To view logs for the API deployment:
    ```bash
    kubectl logs -f deployment/api-deployment
    ```
    Replace `api-deployment` with `postgres-statefulset-0` or `redis-deployment` to view logs for other services.

9.  **Tear down the Kind cluster:**
    When you are done, you can delete the Kind cluster to clean up resources:
    ```bash
    kind delete cluster --name waiting-room-dev
    ```
