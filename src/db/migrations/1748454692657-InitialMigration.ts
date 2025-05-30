import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1748454692657 implements MigrationInterface {
    name = 'InitialMigration1748454692657'

    /**
     * The `up` method defines the database schema changes to be applied.
     * This migration creates the initial `users`, `rooms`, and `room_players` tables,
     * along with their respective columns, primary keys, and foreign key constraints.
     * It's executed when the migration is run (e.g., `npm run typeorm:migration:run`).
     * @param queryRunner Provides an API to execute database queries.
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create the `room_players` table, which acts as a join table between `rooms` and `users`.
        // It tracks which users are associated with which rooms and their status within that room.
        await queryRunner.query(`CREATE TABLE "room_players" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" uuid NOT NULL, "userId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', CONSTRAINT "PK_fa8e2bcf2f068c20f4c3e05ab5f" PRIMARY KEY ("id"))`);
        
        // Create the `rooms` table, storing details about each waiting room.
        // Includes properties like name, visibility, approval requirements, max players, and host.
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "isPublic" boolean NOT NULL DEFAULT true, "approvalRequired" boolean NOT NULL DEFAULT false, "maxPlayers" integer NOT NULL DEFAULT '8', "status" character varying NOT NULL DEFAULT 'waiting', "hostId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
        
        // Create the `users` table, which holds user authentication information.
        // Includes username (unique), hashed password, and timestamps.
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        
        // Add foreign key constraints to establish relationships between tables.
        // `FK_7d92a61295ed0e6378aeb15c121`: `room_players.roomId` references `rooms.id`. `ON DELETE CASCADE` ensures player entries are removed if the room is deleted.
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        // `FK_6669fb46bff7bd4b933df4e3d9d`: `room_players.userId` references `users.id`.
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        // `FK_6c939085068c5539bad393be6b9`: `rooms.hostId` references `users.id`.
        await queryRunner.query(`ALTER TABLE "rooms" ADD CONSTRAINT "FK_6c939085068c5539bad393be6b9" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    /**
     * The `down` method defines the database schema changes to revert the `up` method's actions.
     * This typically involves dropping tables and foreign key constraints in reverse order of creation
     * to avoid dependency issues. It's executed when the migration is reverted (e.g., `npm run typeorm:migration:revert`).
     * @param queryRunner Provides an API to execute database queries.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop foreign key constraints first.
        await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_6c939085068c5539bad393be6b9"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121"`);
        // Then drop the tables.
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP TABLE "room_players"`);
    }

}
