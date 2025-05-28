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
This project implements a RESTful API for managing multiplayer game waiting rooms. It allows users to create, join, and manage game sessions before they start, incorporating robust authentication and a refined database schema.

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
- **Relational Database Design**: Uses TypeORM with SQLite (easily configurable for PostgreSQL/MySQL) for managing `Room`, `User`, and `RoomPlayer` entities.
- **Containerization**: Docker setup for easy deployment.
- **API Documentation**: Swagger/OpenAPI for interactive API exploration.

## Technologies Used
- **Backend**: NestJS (Node.js, TypeScript)
- **Database**: TypeORM with SQLite (can be configured for PostgreSQL, MySQL)
- **Authentication**: JWT (JSON Web Tokens), Passport.js, bcrypt
- **Validation**: Class-validator, Class-transformer
- **Containerization**: Docker
- **API Documentation**: Swagger (OpenAPI)

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
    Create a `.env` file in the project root and add the following:
    ```
    PORT=3000
    JWT_SECRET=your_super_secret_jwt_key_here # CHANGE THIS IN PRODUCTION!
    CORS_ORIGINS=http://localhost:3000,http://localhost:4200 # Adjust as needed for your frontend
    ```
    *Note*: The `JWT_SECRET` should be a strong, randomly generated string in a production environment.

4.  **Database Setup:**
    The application uses SQLite by default, with the database file `db/waiting_room.sqlite`. TypeORM's `synchronize: true` is enabled for development, which automatically creates/updates the database schema on application start. For production, it's recommended to use TypeORM migrations.

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
1.  **Build the Docker image:**
    ```bash
    docker build -t waiting-room-api .
    ```
2.  **Run the Docker container:**
    ```bash
    docker run -p 3000:3000 --env-file ./.env waiting-room-api
    ```
    The `--env-file ./.env` flag passes your local `.env` variables into the container.

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
