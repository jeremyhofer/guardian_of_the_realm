import { Entity, Column, PrimaryColumn, Index, ManyToOne } from 'typeorm';
import { PlayerData } from './PlayerData';

@Entity()
@Index('idx_votes_type_user', ['type', 'user'])
export class Vote {
  @PrimaryColumn()
  vote_id!: number; // INTEGER PRIMARY KEY,

  @ManyToOne(() => PlayerData, (playerData) => playerData.votes)
  @Index('idx_loan_user_id')
  user!: PlayerData; // FOREIGN KEY(user) REFERENCES player_data(user)

  @Column()
  type!: string; // TEXT,

  @Column()
  choice!: string; // TEXT,

  @Column()
  time!: number; // INTEGER,
}
