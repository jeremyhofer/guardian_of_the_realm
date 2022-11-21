import { Entity, Column, PrimaryColumn, OneToOne } from 'typeorm';
import { Siege } from './Siege';

@Entity()
export class TileOwner {
  @PrimaryColumn()
  tile!: string; // TEXT PRIMARY KEY,

  @Column()
  house!: string; // TEXT,

  @Column()
  type!: string; // TEXT,

  @OneToOne(() => Siege, (siege) => siege.tile)
  siege!: Siege;
}
