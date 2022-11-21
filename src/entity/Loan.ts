import { Entity, Column, PrimaryColumn, Index, ManyToOne } from 'typeorm';
import { PlayerData } from './PlayerData';

@Entity()
export class Loan {
  @PrimaryColumn()
  loan_id!: number; // INTEGER PRIMARY KEY,

  @ManyToOne(() => PlayerData, (playerData) => playerData.loans)
  @Index('idx_loan_user_id')
  user!: PlayerData; // FOREIGN KEY(user) REFERENCES player_data(user)

  @Column()
  amount_due!: number; // INTEGER,

  @Column()
  time_due!: number; // INTEGER,
}
