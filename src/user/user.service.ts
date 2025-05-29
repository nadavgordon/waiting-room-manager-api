import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { LoggerService } from '../common/logger/logger.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private readonly logger: LoggerService,
  ) {}

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

  async create(username: string, passwordHash: string): Promise<User> {
    this.logger.log(`Attempting to create user: ${username}`, 'UserService');
    const user = this.usersRepository.create({ username, passwordHash });
    const savedUser = await this.usersRepository.save(user);
    this.logger.log(`User created: ${username}`, 'UserService');
    return savedUser;
  }
}