import { Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { PlayerData } from './PlayerData';
import { Siege } from './Siege';

@Entity()
export class Pledge {
  @PrimaryColumn()
  pledge_id!: number; // INTEGER PRIMARY KEY,

  @ManyToOne(() => Siege, (siege) => siege.pledges)
  @Index('idx_pledges_siege')
  siege!: Siege; // INTEGER,

  @ManyToOne(() => PlayerData, (playerData) => playerData.pledges)
  user!: PlayerData; // TEXT,

  @Column()
  units!: number; // INTEGER,

  @Column()
  choice!: number; // TEXT,
}
