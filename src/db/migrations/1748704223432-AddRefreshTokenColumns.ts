import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokenColumns1748704223432 implements MigrationInterface {
    name = 'AddRefreshTokenColumns1748704223432'

    /**
     * Adds refreshTokenHash and refreshTokenExpiresAt columns to the users table
     * to support JWT refresh token functionality (SYNTH-SEC-003).
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add refreshTokenHash column (nullable)
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenHash" character varying`);
        
        // Add refreshTokenExpiresAt column (nullable)
        await queryRunner.query(`ALTER TABLE "users" ADD "refreshTokenExpiresAt" TIMESTAMP`);
    }

    /**
     * Removes refreshTokenHash and refreshTokenExpiresAt columns from the users table
     * when rolling back the migration.
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove refreshTokenExpiresAt column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenExpiresAt"`);
        
        // Remove refreshTokenHash column
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "refreshTokenHash"`);
    }

}
