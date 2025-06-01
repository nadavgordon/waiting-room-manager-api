import { MigrationInterface, QueryRunner, TableIndex, TableForeignKey } from "typeorm";

export class ApplyIndexesAndCascadePolicies1748748956908 implements MigrationInterface {
    name = 'ApplyIndexesAndCascadePolicies1748748956908'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Create Indexes
        // Indexes for room_players
        await queryRunner.createIndex("room_players", new TableIndex({ name: "IDX_7d92a61295ed0e6378aeb15c12", columnNames: ["roomId"] }));
        await queryRunner.createIndex("room_players", new TableIndex({ name: "IDX_6669fb46bff7bd4b933df4e3d9", columnNames: ["userId"] }));
        await queryRunner.createIndex("room_players", new TableIndex({ name: "IDX_b14bdf73f02a7ac02d7d363e85", columnNames: ["status"] }));

        // Indexes for rooms
        await queryRunner.createIndex("rooms", new TableIndex({ name: "IDX_12a78d090c7a8d44fc2ca37420", columnNames: ["isPublic"] }));
        await queryRunner.createIndex("rooms", new TableIndex({ name: "IDX_ffd12d5e703ed4027ebd41df44", columnNames: ["status"] }));
        await queryRunner.createIndex("rooms", new TableIndex({ name: "IDX_6c939085068c5539bad393be6b", columnNames: ["hostId"] }));

        // Index for users
        await queryRunner.createIndex("users", new TableIndex({ name: "IDX_fe0bb3f6520ee0469504521e71", columnNames: ["username"] }));

        // Step 2: Update Foreign Key Policies
        // For room_players table
        await queryRunner.dropForeignKey("room_players", "FK_7d92a61295ed0e6378aeb15c121"); // Assuming this is the existing FK name
        await queryRunner.createForeignKey("room_players", new TableForeignKey({
            name: "FK_7d92a61295ed0e6378aeb15c121", // Re-use name or use new if preferred
            columnNames: ["roomId"],
            referencedColumnNames: ["id"],
            referencedTableName: "rooms",
            onDelete: "CASCADE",
            onUpdate: "NO ACTION"
        }));

        await queryRunner.dropForeignKey("room_players", "FK_6669fb46bff7bd4b933df4e3d9d"); // Assuming this is the existing FK name
        await queryRunner.createForeignKey("room_players", new TableForeignKey({
            name: "FK_6669fb46bff7bd4b933df4e3d9d",
            columnNames: ["userId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "CASCADE",
            onUpdate: "NO ACTION"
        }));

        // For rooms table
        await queryRunner.dropForeignKey("rooms", "FK_6c939085068c5539bad393be6b9"); // Assuming this is the existing FK name
        await queryRunner.createForeignKey("rooms", new TableForeignKey({
            name: "FK_6c939085068c5539bad393be6b9",
            columnNames: ["hostId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "CASCADE",
            onUpdate: "NO ACTION"
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Step 1: Revert Foreign Key Policies
        // For room_players table
        await queryRunner.dropForeignKey("room_players", "FK_7d92a61295ed0e6378aeb15c121");
        await queryRunner.createForeignKey("room_players", new TableForeignKey({
            name: "FK_7d92a61295ed0e6378aeb15c121",
            columnNames: ["roomId"],
            referencedColumnNames: ["id"],
            referencedTableName: "rooms",
            onDelete: "NO ACTION", // Revert to original
            onUpdate: "NO ACTION"
        }));

        await queryRunner.dropForeignKey("room_players", "FK_6669fb46bff7bd4b933df4e3d9d");
        await queryRunner.createForeignKey("room_players", new TableForeignKey({
            name: "FK_6669fb46bff7bd4b933df4e3d9d",
            columnNames: ["userId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "NO ACTION", // Revert to original
            onUpdate: "NO ACTION"
        }));

        // For rooms table
        await queryRunner.dropForeignKey("rooms", "FK_6c939085068c5539bad393be6b9");
        await queryRunner.createForeignKey("rooms", new TableForeignKey({
            name: "FK_6c939085068c5539bad393be6b9",
            columnNames: ["hostId"],
            referencedColumnNames: ["id"],
            referencedTableName: "users",
            onDelete: "NO ACTION", // Revert to original
            onUpdate: "NO ACTION"
        }));

        // Step 2: Drop Indexes
        await queryRunner.dropIndex("users", "IDX_fe0bb3f6520ee0469504521e71");
        await queryRunner.dropIndex("rooms", "IDX_6c939085068c5539bad393be6b");
        await queryRunner.dropIndex("rooms", "IDX_ffd12d5e703ed4027ebd41df44");
        await queryRunner.dropIndex("rooms", "IDX_12a78d090c7a8d44fc2ca37420");
        await queryRunner.dropIndex("room_players", "IDX_b14bdf73f02a7ac02d7d363e85");
        await queryRunner.dropIndex("room_players", "IDX_6669fb46bff7bd4b933df4e3d9");
        await queryRunner.dropIndex("room_players", "IDX_7d92a61295ed0e6378aeb15c12");
    }
}
