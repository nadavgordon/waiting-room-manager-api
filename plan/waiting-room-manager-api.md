# Post Interview Task

## Backend Engineer

### Waiting Room Manager API 2022

**Estimated Time:** 1-2 days

## Overview

Build a RESTful API for managing multiplayer game waiting rooms. The system should allow users to:

- Create game rooms
- Set visibility and player limits
- Join and leave rooms
- Start and destroy games

The goal is to evaluate your backend development skills along with basic containerization and deployment capabilities.

### Technology Stack (Choose One)

You may use either of the following stacks:

1. PHP (version 8.2+) using Laravel (Version 10+)
2. Node.js using either:
   - NestJS
   - AdonisJS
   - Vanilla Express (with TypeScript)

For data storage – use a well-known ORM, connected to one of:
- SQLite
- MySQL
- PostgreSQL

## Requirements

- Authentication can be simulated or implemented (e.g., API key, user ID in header).
- Users can create waiting rooms and become a host.
- Rooms can have the following configurations:
  - Title.
  - Is Public or private? (listed in the Waiting Room List API)
  - Should existing player approve join requests?
  - Minimum/Maximum Players.
  - Auto start when fully booked or manual start by host.

## API Definition

The API Should Include the following capabilities (exact definition may be modified as you wish):

- Create a new Room - `POST /api/rooms`
- List Waiting Rooms – returns public rooms + private rooms in which the user (if exists) is registered as a host/player – `GET /api/rooms`
- Request to join a room - `POST /api/rooms/{room}/join`
- Approve/decline a join request - `POST /api/rooms/{room}/pending-requests/{request}/respond`
- Leave a room - `POST /api/rooms/{room}/leave`
- Start the game (as a host, when all requirements are satisfied) - `POST /api/rooms/{id}/start`
- Delete a room – `DELETE /api/rooms/{room}`
- Anything else you might want to add (e.g., authentication, host user management, update room settings, etc.)

## Implementation Requirements

- Codebase must be organized and well structured
- Use a well-known framework/library for the chosen stack
- Use a well-known ORM for database interactions
- Implement proper error handling and logging
- Ensure the API is stateless
- All API endpoints should be secured (e.g., authentication, authorization)
- Use proper HTTP status codes
- Use meaningful variable and function names
- Write clean, readable, and maintainable code
- Room identifier should be random and hard to guess.
- Implement a fine-grained CORS management (do not allow ‘*’) using a middleware or existing solution.
- The code should be fully protected against SQL Injection and other common security breaches.
- Bonus – implement a trusted proxy mechanism to get the IP address of the end user.
- The codebase and/or repository must not include any secret.

## DevOps - CI/CD Preparations

Prepare the app for containerized deployment:

### Docker

- Define a multi-step Dockerfile to build and run the app
- Configure `.dockerignore` file
- Use environment variables for config
- Don’t run as root

### Kubernetes (Bonus)

Provide YAMLs for:

- `deployment.yaml` – Deploys app container
- `service.yaml` – Exposes the app
- `configmap.yaml` and `secret.yaml` – Manages app settings
- (Optional) run migrations automatically on every version update deployment.

## Bonus (Optional)

The following tasks are not required, but will add points if implemented correctly:

- Provide a Swagger / OpenAPI / Postman Collection for the API
- Basic test coverage (unit or integration)
- Rate limiting on joins or room creation.
- Helm chart definition for the Kubernetes deployment.
- Basic frontend app that uses the API (full or partial feature support).
- Command Line Interface (CLI) for managing the rooms.

## Submission Checklist

- Source code in a public Git repo or ZIP (for private git repos contact us for user details).
- Dockerfile + Kubernetes YAMLs as part of the source code.
- README with:
  - API Description & usage
  - Setup instructions (local & containerized)
  - Deployment steps with Docker/Kubernetes
  - Database migration instructions
  - Any other important notes/assumptions.

- Send the completed task to `interview@tech.co.il`

Good Luck!

We are looking forward to hearing from you,
and hope you enjoy the process.

For any question, contact us on
`interview@tech.co.il` or via your recruiter

**Tech Digital Powerhouse**
