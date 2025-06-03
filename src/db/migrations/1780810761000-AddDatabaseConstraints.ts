import { MigrationInterface, QueryRunner, TableUnique } from 'typeorm';

/**
 * Migration to strengthen database-level constraints as part of SYNTH-REL-003
 * 
 * This migration implements database-level constraints for improved data integrity:
 * 
 * 1. Unique constraint on roomId+userId in room_players table to prevent duplicate entries
 * 2. Check constraints for enum fields (RoomStatus, RoomPlayerStatus) to ensure valid values
 * 3. Minimum value constraint for maxPlayers in rooms table to ensure logical room sizes
 *
 * @see SYNTH-REL-003 in comprehensive audit agenda
 */
export class AddDatabaseConstraints1780810761000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // First, let's check the database type to use appropriate SQL syntax
    const dbType = queryRunner.connection.options.type;
    
    // Determine if database uses snake_case or camelCase for column names
    // Default to snake_case which is common in PostgreSQL
    const maxPlayersColumn = 'max_players'; 
    
    try {
      // 1. Add unique constraint to prevent duplicate room-user combinations
      // This ensures a user can only appear once per room (in any status)
      await queryRunner.query(`
        ALTER TABLE room_players ADD CONSTRAINT "UQ_room_players_roomId_userId"
        UNIQUE ("roomId", "userId")
      `);
      console.log('✅ Added unique constraint on room_players (roomId, userId)');
      
      // 2. Add check constraints for enum fields
      
      // RoomStatus check constraint (waiting, in-progress, finished)
      await queryRunner.query(`
        ALTER TABLE rooms ADD CONSTRAINT "CHK_rooms_status"
        CHECK (status IN ('waiting', 'in-progress', 'finished'))
      `);
      console.log('✅ Added check constraint for room status enum values');
      
      // RoomPlayerStatus check constraint (active, pending, declined, left)
      await queryRunner.query(`
        ALTER TABLE room_players ADD CONSTRAINT "CHK_room_players_status"
        CHECK (status IN ('active', 'pending', 'declined', 'left'))
      `);
      console.log('✅ Added check constraint for room player status enum values');
      
      // 3. Add minimum value constraint for maxPlayers in rooms table
      // Try with camelCase first (TypeORM style)
      try {
        await queryRunner.query(`
          ALTER TABLE rooms ADD CONSTRAINT "CHK_rooms_maxPlayers_min"
          CHECK ("maxPlayers" >= 2)
        `);
        console.log('✅ Added check constraint for minimum max players (camelCase column)');
      } catch (err) {
        // If camelCase fails, try with snake_case
        await queryRunner.query(`
          ALTER TABLE rooms ADD CONSTRAINT "CHK_rooms_maxPlayers_min"
          CHECK (max_players >= 2)
        `);
        console.log('✅ Added check constraint for minimum max players (snake_case column)');
      }
      
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    console.log('✅ Migration AddDatabaseConstraints completed successfully');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      // Remove constraints in reverse order of creation
      
      // 3. Remove minimum value constraint for maxPlayers
      try {
        await queryRunner.query(`
          ALTER TABLE rooms DROP CONSTRAINT "CHK_rooms_maxPlayers_min"
        `);
        console.log('✅ Removed check constraint for minimum max players');
      } catch (err) {
        console.warn('⚠️ Could not remove maxPlayers constraint, may not exist:', err.message);
      }
      
      // 2. Remove check constraints for enum fields
      try {
        await queryRunner.query(`
          ALTER TABLE room_players DROP CONSTRAINT "CHK_room_players_status"
        `);
        console.log('✅ Removed check constraint for room player status');
      } catch (err) {
        console.warn('⚠️ Could not remove room player status constraint, may not exist:', err.message);
      }
      
      try {
        await queryRunner.query(`
          ALTER TABLE rooms DROP CONSTRAINT "CHK_rooms_status"
        `);
        console.log('✅ Removed check constraint for room status');
      } catch (err) {
        console.warn('⚠️ Could not remove room status constraint, may not exist:', err.message);
      }
      
      // 1. Remove unique constraint for room-user combinations
      try {
        await queryRunner.query(`
          ALTER TABLE room_players DROP CONSTRAINT "UQ_room_players_roomId_userId"
        `);
        console.log('✅ Removed unique constraint on room_players');
      } catch (err) {
        console.warn('⚠️ Could not remove unique constraint, may not exist:', err.message);
      }
      
    } catch (error) {
      console.error('❌ Migration reversion failed:', error);
      throw error;
    }
    
    console.log('✅ Reverted migration AddDatabaseConstraints successfully');
  }
}
