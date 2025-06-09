import { validate } from 'class-validator';
import { UpdateRoomDto } from './update-room.dto';
import { RoomStatus } from '../entities/room.entity';

describe('UpdateRoomDto', () => {
  describe('name validation (optional)', () => {
    it('should pass if name is valid', async () => {
      const dto = new UpdateRoomDto();
      dto.name = 'My Updated Room';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass if name is not provided (optional)', async () => {
      const dto = new UpdateRoomDto();
      // name is intentionally omitted
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if name is provided but empty', async () => {
      const dto = new UpdateRoomDto();
      dto.name = '';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      // class-validator's @MinLength implies @IsNotEmpty for non-empty strings.
      expect(nameError?.constraints).toHaveProperty('minLength'); 
    });

    it('should fail if name is too short', async () => {
      const dto = new UpdateRoomDto();
      dto.name = 'A';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('minLength');
    });

    it('should fail if name is too long', async () => {
      const dto = new UpdateRoomDto();
      dto.name = 'A'.repeat(51);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('maxLength');
    });

    it('should fail if name is not a string', async () => {
      const dto = new UpdateRoomDto();
      // @ts-expect-error testing invalid type
      dto.name = 123;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isString');
    });
  });

  describe('maxPlayers validation (optional)', () => {
    it('should pass if maxPlayers is valid', async () => {
      const dto = new UpdateRoomDto();
      dto.maxPlayers = 8;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass if maxPlayers is not provided (optional)', async () => {
      const dto = new UpdateRoomDto();
      // maxPlayers is intentionally omitted
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if maxPlayers is less than 2', async () => {
      const dto = new UpdateRoomDto();
      dto.maxPlayers = 1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('min');
    });

    it('should fail if maxPlayers is greater than 100', async () => {
      const dto = new UpdateRoomDto();
      dto.maxPlayers = 101;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('max');
    });

    it('should fail if maxPlayers is not an integer', async () => {
      const dto = new UpdateRoomDto();
      dto.maxPlayers = 4.5 as any; // Cast to any to bypass TS type check for testing runtime validation
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('isInt');
    });
  });


  describe('status validation (optional)', () => {
    it('should pass if status is a valid RoomStatus enum value', async () => {
      const dto = new UpdateRoomDto();
      dto.status = RoomStatus.IN_PROGRESS;
      let errors = await validate(dto);
      expect(errors.length).toBe(0);

      dto.status = RoomStatus.WAITING;
      errors = await validate(dto);
      expect(errors.length).toBe(0);

      dto.status = RoomStatus.FINISHED;
      errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass if status is not provided (optional)', async () => {
      const dto = new UpdateRoomDto();
      // status is intentionally omitted
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if status is not a valid RoomStatus enum value', async () => {
      const dto = new UpdateRoomDto();
      dto.status = 'invalid-status' as any; // Cast to any to bypass TS type check for testing
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const statusError = errors.find(e => e.property === 'status');
      expect(statusError).toBeDefined();
      expect(statusError?.constraints).toHaveProperty('isEnum');
    });
  });

  describe('Combined validations', () => {
    it('should pass with all valid optional fields provided', async () => {
      const dto = new UpdateRoomDto();
      dto.name = 'Super Updated Room';
      dto.maxPlayers = 10;
      dto.status = RoomStatus.WAITING;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with no fields provided (all optional)', async () => {
      const dto = new UpdateRoomDto();
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if multiple fields are invalid', async () => {
      const dto = new UpdateRoomDto();
      dto.name = 'X'; // Too short
      dto.maxPlayers = 1; // Too few
      dto.status = 'another-invalid-status' as any;
      const errors = await validate(dto);
      // Expect 3 errors: name, maxPlayers, status
      expect(errors.length).toBe(3);
    });
  });
});
