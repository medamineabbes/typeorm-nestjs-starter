/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { IBaseEntity } from 'src/common/base/base.entity';
import { appLogger } from 'src/logger/winston.logger';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  FindOptionsWhere,
} from 'typeorm';
import { BaseRepository } from './base.repository';
import { NotFound } from '../constants/errors/exceptions.error';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export interface GetOptions {
  mustExist?: boolean;
}

export abstract class BaseService<TEntity extends IBaseEntity> {
  constructor(private readonly repository: BaseRepository<TEntity>) {}

  getEntityName(): string {
    if (typeof this.repository.entityType === 'function') {
      return this.repository.entityType.name;
    }
    return (this.repository.entityType as any).name || 'Unknown';
  }

  getServiceName(): string {
    return this.constructor.name;
  }

  async findOne(
    criteria: FindOneOptions<TEntity>,
    opts?: GetOptions,
  ): Promise<TEntity | null> {
    const entity = await this.repository.findOne(criteria);

    opts = opts || {};

    if (!entity && opts.mustExist === true) {
      appLogger.error({
        label: this.getServiceName(),
        message: `Could not find ${this.getEntityName()}`,
      });
      throw new NotFound(`${this.getEntityName()} not found`);
    }
    return entity;
  }

  async getById(id: string, mustExist?: boolean): Promise<TEntity | null> {
    return this.findOne({ where: { id } } as FindOneOptions<TEntity>, {
      mustExist,
    });
  }

  search(filter?: FindManyOptions<TEntity>): Promise<TEntity[]> {
    return this.repository.search(filter);
  }

  findAndCount(
    filter?: FindManyOptions<TEntity>,
  ): Promise<[TEntity[], number]> {
    return this.repository.findAndCount(filter);
  }

  async create(entity: DeepPartial<TEntity>): Promise<TEntity> {
    const savedEntity = await this.repository.create(entity);

    appLogger.info({
      label: this.getServiceName(),
      message: `${this.getEntityName()} created successfully - ${savedEntity.id}`,
      details: savedEntity,
    });
    return savedEntity;
  }

  async createEach(entity: DeepPartial<TEntity>[]): Promise<TEntity[]> {
    const savedEntities = await this.repository.createEach(entity);

    appLogger.info({
      label: this.getServiceName(),
      message: `${this.getEntityName()} created successfully - ${savedEntities.length} records`,
      details: savedEntities,
    });
    return savedEntities;
  }

  async updateByCriteria(
    criteria: FindOptionsWhere<TEntity>,
    partial: QueryDeepPartialEntity<TEntity>,
    opts: GetOptions = { mustExist: true },
  ): Promise<TEntity[]> {
    return this.repository.updateByCriteria(criteria, partial, opts);
  }

  async updateByIds(
    ids: string[],
    partial: QueryDeepPartialEntity<TEntity>,
  ): Promise<TEntity[]> {
    return await this.repository.updateByIds(ids, partial);
  }

  async updateById(
    id: string,
    partial: QueryDeepPartialEntity<TEntity>,
  ): Promise<TEntity> {
    return this.repository.updateById(id, partial);
  }

  async deleteByCriteria(
    criteria: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
    hard?: boolean,
  ): Promise<TEntity[]> {
    return this.repository.deleteByCriteria(criteria, hard);
  }

  async deleteByIds(ids: string[], hard?: boolean): Promise<TEntity[]> {
    return this.repository.deleteByIds(ids, hard);
  }

  async deleteById(id: string, hard?: boolean): Promise<TEntity> {
    return await this.repository.deleteById(id, hard);
  }
}
