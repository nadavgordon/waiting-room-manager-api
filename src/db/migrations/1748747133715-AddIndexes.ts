import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIndexes1748747133715 implements MigrationInterface {
    name = 'AddIndexes1748747133715'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "room_players" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "roomId" uuid NOT NULL, "userId" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', CONSTRAINT "PK_fa8e2bcf2f068c20f4c3e05ab5f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7d92a61295ed0e6378aeb15c12" ON "room_players" ("roomId") `);
        await queryRunner.query(`CREATE INDEX "IDX_6669fb46bff7bd4b933df4e3d9" ON "room_players" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_b14bdf73f02a7ac02d7d363e85" ON "room_players" ("status") `);
        await queryRunner.query(`CREATE TABLE "rooms" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "isPublic" boolean NOT NULL DEFAULT true, "approvalRequired" boolean NOT NULL DEFAULT false, "maxPlayers" integer NOT NULL DEFAULT '8', "status" character varying NOT NULL DEFAULT 'waiting', "hostId" uuid NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0368a2d7c215f2d0458a54933f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12a78d090c7a8d44fc2ca37420" ON "rooms" ("isPublic") `);
        await queryRunner.query(`CREATE INDEX "IDX_ffd12d5e703ed4027ebd41df44" ON "rooms" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_6c939085068c5539bad393be6b" ON "rooms" ("hostId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "refreshTokenHash" character varying, "refreshTokenExpiresAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "room_players" ADD CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "rooms" ADD CONSTRAINT "FK_6c939085068c5539bad393be6b9" FOREIGN KEY ("hostId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "rooms" DROP CONSTRAINT "FK_6c939085068c5539bad393be6b9"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_6669fb46bff7bd4b933df4e3d9d"`);
        await queryRunner.query(`ALTER TABLE "room_players" DROP CONSTRAINT "FK_7d92a61295ed0e6378aeb15c121"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6c939085068c5539bad393be6b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ffd12d5e703ed4027ebd41df44"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12a78d090c7a8d44fc2ca37420"`);
        await queryRunner.query(`DROP TABLE "rooms"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b14bdf73f02a7ac02d7d363e85"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6669fb46bff7bd4b933df4e3d9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d92a61295ed0e6378aeb15c12"`);
        await queryRunner.query(`DROP TABLE "room_players"`);
    }

}
