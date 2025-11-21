/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable } from '@nestjs/common';
import { User } from './user.entity';
import { BaseRepository } from '@/common/base/base.repository';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Injectable()
export class UserRepository extends BaseRepository<any> {
  constructor(@InjectDataSource() dataSource: DataSource) {
    super(dataSource, User);
  }
}
