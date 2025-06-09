import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto', () => {
  describe('username', () => {
    it('should pass validation with a valid username and password', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'Password123!';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if username is too short', async () => {
      const dto = new CreateUserDto();
      dto.username = 'us'; // Less than 3 characters
      dto.password = 'Password123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail if username is too long', async () => {
      const dto = new CreateUserDto();
      dto.username = 'a'.repeat(31); // More than 30 characters
      dto.password = 'Password123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('maxLength');
    });

    it('should fail if username is empty', async () => {
      const dto = new CreateUserDto();
      dto.username = '';
      dto.password = 'Password123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail if username contains invalid characters', async () => {
      const dto = new CreateUserDto();
      dto.username = 'invalid-user!'; // Contains '-' and '!'
      dto.password = 'Password123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });
  });

  describe('password', () => {
    it('should fail if password is too short', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'Pass1!'; // Less than 8 characters
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('minLength');
    });

    it('should fail if password does not meet complexity (no uppercase)', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'password123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail if password does not meet complexity (no lowercase)', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'PASSWORD123!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail if password does not meet complexity (no digit)', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'Password!';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail if password does not meet complexity (no special character)', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches');
    });

    it('should fail if password is too long', async () => {
      const dto = new CreateUserDto();
      dto.username = 'valid_user';
      dto.password = 'Password123!Extra'; // More than 12 characters
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('matches'); // The regex also enforces max length
    });
  });
});
