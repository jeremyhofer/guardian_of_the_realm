import { Entity, Column, PrimaryColumn, ManyToOne } from 'typeorm';
import { PlayerData } from './PlayerData';

@Entity()
export class Loan {
  @PrimaryColumn()
  loan_id!: number; // INTEGER PRIMARY KEY,

  // @Index('idx_loan_user_id')
  @ManyToOne(() => PlayerData, (playerData) => playerData.loans)
  user!: PlayerData; // FOREIGN KEY(user) REFERENCES player_data(user)

  @Column()
  amount_due!: number; // INTEGER,

  @Column()
  time_due!: number; // INTEGER,
}
