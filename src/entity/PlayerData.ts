import { Entity, Column, PrimaryColumn, Index, OneToMany } from 'typeorm';
import { Loan } from './Loan';
import { Pledge } from './Pledge';
import { Vote } from './Vote';

@Entity()
export class PlayerData {
  @PrimaryColumn()
  @Index('idx_player_data_id', { unique: true })
  user!: string; // TEXT PRIMARY KEY,

  @Column()
  house!: string; // TEXT,

  @Column()
  men!: number; // INTEGER,

  @Column()
  ships!: number; // INTEGER,

  @Column()
  money!: number; // INTEGER,

  @Column()
  arson_last_time!: number; // INTEGER,

  @Column()
  pirate_last_time!: number; // INTEGER,

  @Column()
  pray_last_time!: number; // INTEGER,

  @Column()
  raid_last_time!: number; // INTEGER,

  @Column()
  smuggle_last_time!: number; // INTEGER,

  @Column()
  scandal_last_time!: number; // INTEGER,

  @Column()
  spy_last_time!: number; // INTEGER,

  @Column()
  subvert_last_time!: number; // INTEGER,

  @Column()
  thief_last_time!: number; // INTEGER,

  @Column()
  train_last_time!: number; // INTEGER,

  @Column()
  trade_last_time!: number; // INTEGER,

  @Column()
  work_last_time!: number; // INTEGER

  @OneToMany(() => Loan, (loan) => loan.user)
  loans!: Loan[];

  @OneToMany(() => Vote, (vote) => vote.user)
  votes!: Vote[];

  @OneToMany(() => Pledge, (pledge) => pledge.user)
  pledges!: Pledge[];
}
