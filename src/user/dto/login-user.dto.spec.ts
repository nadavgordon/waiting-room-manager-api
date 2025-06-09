import { validate } from 'class-validator';
import { LoginUserDto } from './login-user.dto';

describe('LoginUserDto', () => {
  describe('username validation', () => {
    it('should pass with a valid username', async () => {
      const dto = new LoginUserDto();
      dto.username = 'testuser';
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'username').length).toBe(0);
    });

    it('should fail if username is too short', async () => {
      const dto = new LoginUserDto();
      dto.username = 'us'; // MinLength is 3
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'username')?.constraints?.minLength).toBeDefined();
    });

    it('should fail if username is too long', async () => {
      const dto = new LoginUserDto();
      dto.username = 'a'.repeat(31); // MaxLength is 30
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'username')?.constraints?.maxLength).toBeDefined();
    });

    it('should fail if username is empty', async () => {
      const dto = new LoginUserDto();
      dto.username = '';
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'username')?.constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail if username is not a string', async () => {
      const dto = new LoginUserDto();
      (dto.username as any) = 123;
      dto.password = 'Password123';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'username')?.constraints?.isString).toBeDefined();
    });
  });

  describe('password validation', () => {
    it('should pass with a valid password', async () => {
      const dto = new LoginUserDto();
      dto.username = 'testuser';
      dto.password = 'Password123'; // MinLength is 8
      const errors = await validate(dto);
      expect(errors.filter((e) => e.property === 'password').length).toBe(0);
    });

    it('should fail if password is too short', async () => {
      const dto = new LoginUserDto();
      dto.username = 'testuser';
      dto.password = 'Pass123'; // MinLength is 8
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'password')?.constraints?.minLength).toBeDefined();
    });

    it('should fail if password is empty', async () => {
      const dto = new LoginUserDto();
      dto.username = 'testuser';
      dto.password = '';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'password')?.constraints?.isNotEmpty).toBeDefined();
    });

    it('should fail if password is not a string', async () => {
      const dto = new LoginUserDto();
      dto.username = 'testuser';
      (dto.password as any) = 12345678;
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'password')?.constraints?.isString).toBeDefined();
    });
  });

  describe('overall validation', () => {
    it('should pass with valid username and password', async () => {
      const dto = new LoginUserDto();
      dto.username = 'validuser';
      dto.password = 'ValidPass123';
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should fail if username is missing', async () => {
      const dto = new LoginUserDto();
      dto.password = 'ValidPass123';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'username')).toBeDefined();
    });

    it('should fail if password is missing', async () => {
      const dto = new LoginUserDto();
      dto.username = 'validuser';
      const errors = await validate(dto);
      expect(errors.find((e) => e.property === 'password')).toBeDefined();
    });
  });
});
