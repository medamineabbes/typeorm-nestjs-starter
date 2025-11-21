import { IBaseEntity } from 'src/common/base/base.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity({ name: 't_user' })
export class User implements IBaseEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'usr_id' })
  id: string;

  @CreateDateColumn({ name: 'usr_creation_date', type: 'timestamp' })
  creationDate: Date;

  @UpdateDateColumn({ name: 'usr_update_date', type: 'timestamp' })
  updateDate: Date;

  @DeleteDateColumn({ name: 'usr_deletion_date', type: 'timestamp' })
  deletionDate: Date;

  @Column({ name: 'usr_first_name', type: 'varchar' })
  firstName: string;

  @Column({ name: 'usr_last_name', type: 'varchar' })
  lastName: string;

  @Column({ name: 'usr_email', type: 'varchar' })
  email: string;

  @Column({ name: 'usr_password', type: 'varchar' })
  password: string;

  @Column({ name: 'usr_roles', type: 'jsonb' })
  roles: JSON;
}
