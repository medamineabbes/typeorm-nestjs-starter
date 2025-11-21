/* eslint-disable @typescript-eslint/no-unsafe-call */
import { BaseService } from '@/common/base/base.service';
import { User } from './user.entity';
import { UserRepository } from './user.repository';

export class UserService extends BaseService<User> {
  constructor(private readonly userRepository: UserRepository) {
    super(userRepository);
  }

  // TODO: add methods for user management
}
