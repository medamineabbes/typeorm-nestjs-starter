import {
  DataSource,
  FindManyOptions,
  FindOptionsWhere,
  Repository,
  In,
  DeepPartial,
  FindOneOptions,
  EntityMetadata,
  ObjectLiteral,
} from 'typeorm';
import { IBaseEntity } from './base.entity';
import { appLogger } from 'src/logger/winston.logger';
import { filter, isArray, isEmpty, map, reduce } from 'lodash';
import { RawConstructor } from './constructors';
import { readFileSync } from 'fs';
import { sep } from 'upath';
import mybatisMapper from 'mybatis-mapper';
import { walkFolder } from '../utils/common.utils';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import path from 'path';
import { GetOptions } from './base.service';

export abstract class BaseRepository<TEntity extends IBaseEntity> {
  private queries: Record<string, string> = {};
  private fileMap: Record<string, string> = {};

  constructor(
    private dataSource: DataSource,
    public entityType: RawConstructor,
  ) {
    this.loadQueries(
      path.resolve(
        __dirname,
        `../../models/${this.formatNameForSqlFiles(this.entityType.name)}/sql`,
      ),
    );

    // Dynamically create methods for each SQL file
    Object.keys(this.queries).forEach((key) => {
      if (this.fileMap[key] === '.sql') {
        (this as any)[key] = async (...params: any | any[]) => {
          const query = this.getQuery(key);
          appLogger.debug(query);
          return this.dataSource.query(query, params);
        };
      } else {
        (this as any)[key] = async (params: any | any[]) => {
          const format = { language: 'sql' as const, indent: '  ' };
          const query = mybatisMapper.getStatement(
            this.entityType.name.toLowerCase(),
            this.fileMap[key],
            params,
            format,
          );

          appLogger.debug(query);
          const rawResults = await this.repo.query(query);
          return this.mapEntityColumnNames(rawResults);
        };
      }
    });
  }

  setDataSource(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  getDataSource() {
    return this.dataSource;
  }

  private formatNameForSqlFiles(name: string) {
    return name.replace(
      /[A-Z]+(?![a-z])|[A-Z]/g,
      ($, ofs) => (ofs ? '-' : '') + $.toLowerCase(),
    );
  }
  private loadQueries(directory: string) {
    const xmlFiles: string[] = [];
    const sqlFiles: string[] = [];

    try {
      // Lookup all the sql & xml files
      walkFolder(directory, xmlFiles, 'xml');
      walkFolder(directory, sqlFiles, 'sql');
    } catch (e) {
      appLogger.debug(
        `Cannot find folder ${directory} in order to assign ${this.entityType.name} model queries`,
      );
    }

    if (!sqlFiles.length) {
      appLogger.debug(`No SQL files found in the folder ${directory}`);
    } else {
      sqlFiles.forEach((filePath) => {
        const fileName = filePath.substring(
          filePath.lastIndexOf(sep) + 1,
          filePath.indexOf('.'),
        );

        const methodName = fileName.replace(/([-_][a-z])/g, (group) => {
          return group.toUpperCase().replace('-', '').replace('_', '');
        });
        this.fileMap[methodName] = '.sql';
        this.queries[methodName] = readFileSync(filePath, 'utf8');
      });
    }

    if (!xmlFiles.length) {
      appLogger.debug(`No SQL files found in the folder ${directory}`);
    } else {
      xmlFiles.forEach((filePath) => {
        const fileName = filePath.substring(
          filePath.lastIndexOf(sep) + 1,
          filePath.indexOf('.'),
        );
        const methodName = fileName.replace(/([-_][a-z])/g, (group) => {
          return group.toUpperCase().replace('-', '').replace('_', '');
        });
        this.fileMap[methodName] = fileName;
        this.queries[methodName] = readFileSync(filePath, 'utf8');
      });
      mybatisMapper.createMapper(xmlFiles);
    }
  }

  private getQuery(key: string): string {
    const query = this.queries[key];
    if (!query) {
      throw new Error(`Query "${key}" not found`);
    }
    return query;
  }

  private mapEntityColumnNames(data: TEntity[]) {
    const metadata = this.repo.metadata;

    return data.map((rawResult: any) => {
      const entity = new this.entityType({});

      // Map regular columns
      metadata.columns.forEach((column) => {
        if (rawResult[column.databaseName] !== undefined) {
          // Auto-convert string → number if expected type is Number
          if (
            typeof rawResult[column.databaseName] === 'string' &&
            Reflect.getMetadata('design:type', entity, column.propertyName) ===
              Number &&
            /^\d+(\.\d+)?$/.test(rawResult[column.databaseName])
          ) {
            entity[column.propertyName] = parseFloat(
              rawResult[column.databaseName],
            );
          } else {
            entity[column.propertyName] = rawResult[column.databaseName];
          }
        }
      });

      // Map extension columns
      if (this.entityType.prototype.extensionColumns) {
        this.entityType.prototype.extensionColumns.forEach((extension: any) => {
          if (rawResult[extension.name] !== undefined) {
            // Auto-convert string → number if expected type is Number
            if (
              typeof rawResult[extension.name] === 'string' &&
              Reflect.getMetadata(
                'design:type',
                entity,
                extension.propertyName,
              ) === Number &&
              /^\d+(\.\d+)?$/.test(rawResult[extension.name])
            ) {
              entity[extension.propertyName] = parseFloat(
                rawResult[extension.name],
              );
            } else {
              entity[extension.propertyName] = rawResult[extension.name];
            }
          }
        });
      }

      return entity;
    });
  }

  async customPopulateNativeQuery(
    collection: any,
    association: any,
    criteria: any = {},
  ) {
    appLogger.info('criteria', criteria);
    return new Promise(async (resolve, reject) => {
      if (!collection || !collection.length) return resolve(collection);
      const entityMetadata: EntityMetadata = this.repo.metadata;
      const associationMetadata = entityMetadata.relations.find(
        (relation) => relation.propertyName === association,
      );
      try {
        if (!associationMetadata) {
          return reject('Association Model Not Found');
        }

        const childRepo = this.dataSource.getRepository(
          associationMetadata.type,
        );

        // ONE TO MANY ASSOCIATION
        if (associationMetadata.isOneToMany) {
          appLogger.info('POPULATE ONE TO MANY ASSOCIATION');
          // GET LIST IDS
          const list_ids = collection
            ?.filter((item: any) => item.id)
            .map((item: any) => item.id); // TODO REPLACE WITH PK_ID

          // SET CRITERIA TO FIND IDS
          if (!criteria.where) {
            criteria.where = {};
          }
          criteria.where[this.entityType.name.toLowerCase()] = In(list_ids);
          // FIND SUB-ITEMS BY IDS
          const data = await childRepo.find(criteria);
          for (const item of collection) {
            // ARRAY OF LIST OF ITEMS WITH THIS ID
            const list = data.filter(
              (d: any) =>
                d[`${this.entityType.name.toLowerCase()}Id`] === item.id,
            );
            // ATTACH ARRAY TO THE COLLECTIONd
            item[association] = list;
          }
          return resolve(collection);
        } else {
          // MANY TO ONE ASSOCIATION
          appLogger.info('POPULATE MANY TO ONE ASSOCIATION');
          const list_ids = collection
            .filter((item: any) => item[`${association}Id`])
            .map((item: any) => item[`${association}Id`]);
          appLogger.info('list_ids', list_ids);

          // SET CRITERIA TO FIND IDS
          if (!criteria.where) {
            criteria.where = {};
          }
          criteria.where.id = In(list_ids);
          appLogger.info('criteria', criteria);

          const data = await childRepo.find(criteria);

          for (const item of collection) {
            const data_association = data.find(
              (d: any) => d.id === item[`${association}Id`],
            );
            if (data_association) {
              item[association] = data_association;
            }
          }
          return resolve(collection);
        }
      } catch (e) {
        return reject(e);
      }
    });
  }

  sanitizeInput<T extends ObjectLiteral>(
    repo: Repository<T>,
    input: any,
  ): QueryDeepPartialEntity<T> {
    const entityColumns = repo.metadata.columns.map((col) => col.propertyName);

    const clean: QueryDeepPartialEntity<T> = {};
    for (const key of entityColumns) {
      if (key in input) {
        (clean as any)[key] = input[key];
      }
    }

    return clean;
  }

  get repo(): Repository<TEntity> {
    return this.dataSource.getRepository(this.entityType);
  }

  async findOne(criteria: FindOneOptions<TEntity>): Promise<TEntity | null> {
    return this.repo.findOne(criteria);
  }

  async findById(id: string): Promise<TEntity | null> {
    return this.findOne({ where: { id } } as FindOneOptions<TEntity>);
  }

  async search(filter?: FindManyOptions<TEntity>): Promise<TEntity[]> {
    const result = await this.repo.find(filter);

    return result;
  }

  async findAndCount(
    filter?: FindManyOptions<TEntity>,
  ): Promise<[TEntity[], number]> {
    const result = await this.repo.findAndCount(filter);

    return result;
  }

  async create(entity: DeepPartial<TEntity>): Promise<TEntity> {
    const data = this.repo.create(entity);
    return this.repo.save(data);
  }

  async createEach(entities: DeepPartial<TEntity>[]): Promise<TEntity[]> {
    const data = this.repo.create(entities);
    return this.repo.save(data);
  }

  async updateById(
    id: string,
    partialEntity: QueryDeepPartialEntity<TEntity>,
  ): Promise<TEntity> {
    const entity = await this.findById(id);

    if (!entity) {
      throw new Error(`Entity with ID ${id} not found`);
    }

    const sanitizedPartialEntity = this.sanitizeInput(this.repo, partialEntity);

    await this.repo.update(id, sanitizedPartialEntity);

    return { ...entity, ...sanitizedPartialEntity };
  }

  async updateByIds(
    ids: string[],
    partialEntity: QueryDeepPartialEntity<TEntity>,
  ) {
    const entities = (await this.search({
      where: { id: In(ids) },
    } as FindManyOptions<TEntity>)) as TEntity[];

    if (!entities || entities.length === 0) {
      throw new Error(
        `Entities not found with criteria : ${JSON.stringify(ids)}`,
      );
    }

    const sanitizedPartialEntity = this.sanitizeInput(this.repo, partialEntity);

    await this.repo.update(ids, sanitizedPartialEntity);

    return entities.map(
      (e) =>
        new this.entityType({ ...e, ...sanitizedPartialEntity }) as TEntity,
    );
  }

  async updateByCriteria(
    criteria: FindOptionsWhere<TEntity>,
    partialEntity: QueryDeepPartialEntity<TEntity>,
    opts: GetOptions = { mustExist: true },
  ): Promise<TEntity[]> {
    const items = await this.repo.find({ where: criteria });

    if (!items || items.length === 0) {
      if (opts.mustExist) {
        throw new Error(
          `Entities not found with criteria : ${JSON.stringify(criteria)}`,
        );
      } else {
        return [];
      }
    }

    const sanitizedPartialEntity = this.sanitizeInput(this.repo, partialEntity);

    this.repo.update(
      items.map((item) => item.id),
      sanitizedPartialEntity,
    );

    return map(items, (item) => ({ ...item, ...sanitizedPartialEntity }));
  }

  async deleteByCriteria(
    criteria: FindOptionsWhere<TEntity> | FindOptionsWhere<TEntity>[],
    hard?: boolean,
  ): Promise<TEntity[]> {
    // TODO: test hard and soft delete
    if (hard) {
      const result = await this.repo.delete(criteria);

      if (result.affected === 0) {
        throw new Error(
          `No entities found for criteria: ${JSON.stringify(criteria)}`,
        );
      }
    }

    const entities = await this.repo.find({ where: criteria });
    if (!entities || entities.length === 0) {
      throw new Error(
        `Entities not found with criteria : ${JSON.stringify(criteria)}`,
      );
    }

    const date = new Date();

    this.repo.update(
      entities.map((item) => item.id),
      {
        deletionDate: date,
      } as unknown as QueryDeepPartialEntity<TEntity>,
    );

    return entities.map((e) => ({ ...e, deletionDate: date }));
  }

  async deleteByIds(ids: string[], hard?: boolean): Promise<TEntity[]> {
    return this.deleteByCriteria({ id: In(ids) as any }, hard);
  }

  async deleteById(id: string, hard?: boolean): Promise<TEntity> {
    const res = await this.deleteByIds([id], hard);
    return res?.[0];
  }

  async saveOrIgnore(
    _entities: TEntity[] | TEntity,
    fieldsToCheck?: Array<keyof TEntity>,
  ): Promise<[TEntity[], TEntity[]]> {
    const entities = isArray(_entities) ? _entities : [_entities];

    const saveOne = async (entity: TEntity): Promise<[TEntity, boolean]> => {
      const criteria = reduce(
        fieldsToCheck,
        (acc, field) => ({ ...acc, [field]: entity[field] }),
        {},
      );

      const existing = await this.findOne(
        (!isEmpty(criteria)
          ? ({ where: criteria } as FindOneOptions<TEntity>)
          : { where: { id: entity.id } }) as FindOneOptions<TEntity>,
      );

      if (existing) {
        appLogger.error({
          label: `${this.entityType.name}-Repository`,
          message: `Entity already exists with this criteria ${JSON.stringify(criteria)}`,
        });

        return [{ ...entity, ...existing }, true];
      }

      return [{ ...entity, ...(await this.repo.save(entity)) }, false];
    };

    const result = await Promise.all(map(entities, (e) => saveOne(e)));

    const saved = map(
      filter(result, (r) => !r[1]),
      (r) => r[0],
    );
    const ignored = map(
      filter(result, (r) => r[1]),
      (r) => r[0],
    );

    return [saved, ignored];
  }

  count(filter?: FindManyOptions<TEntity>) {
    return this.repo.count(filter);
  }
}
