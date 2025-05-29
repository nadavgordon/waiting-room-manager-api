import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1748454692657 implements MigrationInterface {
    name = 'InitialMigration1748454692657'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "room_players" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" uuid NOT NULL, "userId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', CONSTRAINT "PK_fa8e2bcf2f068c20f4c3e05ab5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "isPublic" boolean NOT NULL DEFAULT true, "approvalRequired" boolean NOT NULL DEFAULT false, "maxPlayers" integer NOT NULL DEFAULT '8', "status" character varying NOT NULL DEFAULT 'waiting', "hostId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rooms" ADD CONSTRAINT "FK_6c939085068c5539bad393be6b9" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_6c939085068c5539bad393be6b9"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP TABLE "room_players"`);
    }

}
