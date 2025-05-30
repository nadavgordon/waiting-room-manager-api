import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class UserService {
  /**
   * `UserService` is responsible for all business logic related to user data management.
   * It interacts directly with the `User` entity repository to perform CRUD operations.
   */
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Finds a single user by their username.
   * This is a core utility for authentication and user profile retrieval.
   * @param username The unique username to search for.
   * @returns The `User` entity if found, otherwise `null`.
   */
  async findOne(username: string): Promise<User | null> {
    this.logger.log(`Attempting to find user: ${username}`, 'UserService');
    const user = await this.usersRepository.findOne({ where: { username } });
    if (user) {
      this.logger.log(`User found: ${username}`, 'UserService');
    } else {
      this.logger.warn(`User not found: ${username}`, 'UserService');
    }
    return user;
  }

  /**
   * Creates a new user record in the database.
   * This method is used during the registration process after the password has been hashed.
   * @param username The username for the new user.
   * @param passwordHash The securely hashed password.
   * @returns The newly created and persisted `User` entity.
   */
  async create(username: string, passwordHash: string): Promise<User> {
    this.logger.log(`Attempting to create user: ${username}`, 'UserService');
    const user = this.usersRepository.create({ username, passwordHash });
    const savedUser = await this.usersRepository.save(user);
    this.logger.log(`User created: ${username}`, 'UserService');
    return savedUser;
  }
}