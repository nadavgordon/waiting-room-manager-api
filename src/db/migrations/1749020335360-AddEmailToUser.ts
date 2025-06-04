import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEmailToUser1749020335360 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add email column to users table
        await queryRunner.query(`ALTER TABLE "users" ADD "email" varchar UNIQUE NULL`);
        
        // Create index for email column for faster lookups
        await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop index first
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
        
        // Drop email column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "email"`);
    }

}
