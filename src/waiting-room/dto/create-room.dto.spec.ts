import { validate } from 'class-validator';
import { CreateRoomDto } from './create-room.dto';

describe('CreateRoomDto', () => {
  describe('name validation', () => {
    it('should pass with a valid name', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'My Awesome Room';
      dto.maxPlayers = 4;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if name is empty', async () => {
      const dto = new CreateRoomDto();
      dto.name = '';
      dto.maxPlayers = 4;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isNotEmpty');
      expect(nameError?.constraints).toHaveProperty('minLength');
    });

    it('should fail if name is too short', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'A';
      dto.maxPlayers = 4;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('minLength');
    });

    it('should fail if name is too long', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'A'.repeat(51);
      dto.maxPlayers = 4;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('maxLength');
    });

    it('should fail if name is not a string', async () => {
      const dto = new CreateRoomDto();
      // @ts-expect-error testing invalid type
      dto.name = 123;
      dto.maxPlayers = 4;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const nameError = errors.find(e => e.property === 'name');
      expect(nameError).toBeDefined();
      expect(nameError?.constraints).toHaveProperty('isString');
    });
  });

  describe('maxPlayers validation', () => {
    it('should pass with a valid maxPlayers', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 8;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if maxPlayers is less than 2', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 1;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('min');
    });

    it('should fail if maxPlayers is greater than 100', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 101;
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('max');
    });

    it('should fail if maxPlayers is not an integer', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4.5 as any; // Cast to any to bypass TS type check for testing runtime validation
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const maxPlayersError = errors.find(e => e.property === 'maxPlayers');
      expect(maxPlayersError).toBeDefined();
      expect(maxPlayersError?.constraints).toHaveProperty('isInt');
    });

    it('should pass if maxPlayers is not provided (optional)', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      // maxPlayers is intentionally omitted as it's optional
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe('isPublic validation', () => {
    it('should pass if isPublic is a boolean', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      dto.isPublic = true;
      let errors = await validate(dto);
      expect(errors.length).toBe(0);

      dto.isPublic = false;
      errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass if isPublic is not provided (optional)', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      // isPublic is intentionally omitted
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if isPublic is not a boolean', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      // @ts-expect-error testing invalid type
      dto.isPublic = 'not-a-boolean';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const isPublicError = errors.find(e => e.property === 'isPublic');
      expect(isPublicError).toBeDefined();
      expect(isPublicError?.constraints).toHaveProperty('isBoolean');
    });
  });

  describe('approvalRequired validation', () => {
    it('should pass if approvalRequired is a boolean', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      dto.approvalRequired = true;
      let errors = await validate(dto);
      expect(errors.length).toBe(0);

      dto.approvalRequired = false;
      errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass if approvalRequired is not provided (optional)', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      // approvalRequired is intentionally omitted
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if approvalRequired is not a boolean', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Valid Room';
      dto.maxPlayers = 4;
      // @ts-expect-error testing invalid type
      dto.approvalRequired = 'not-a-boolean';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const approvalRequiredError = errors.find(e => e.property === 'approvalRequired');
      expect(approvalRequiredError).toBeDefined();
      expect(approvalRequiredError?.constraints).toHaveProperty('isBoolean');
    });
  });

  describe('Combined validations', () => {
    it('should pass with all valid optional fields provided', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Super Room';
      dto.maxPlayers = 10;
      dto.isPublic = true;
      dto.approvalRequired = false;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should pass with all valid optional fields omitted', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'Basic Room';
      dto.maxPlayers = 2;
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if multiple fields are invalid', async () => {
      const dto = new CreateRoomDto();
      dto.name = 'X'; // Too short
      dto.maxPlayers = 1; // Too few
      // @ts-expect-error testing invalid type
      dto.isPublic = 123;
      // @ts-expect-error testing invalid type
      dto.approvalRequired = {};
      const errors = await validate(dto);
      expect(errors.length).toBe(4); // name, maxPlayers, isPublic, approvalRequired
    });
  });
});
