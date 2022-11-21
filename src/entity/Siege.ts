import { Entity, Column, PrimaryColumn, OneToOne, OneToMany } from 'typeorm';
import { Pledge } from './Pledge';
import { TileOwner } from './TileOwner';

@Entity()
export class Siege {
  @PrimaryColumn()
  siege_id!: number; // INTEGER PRIMARY KEY,

  // @Index('idx_siege_tile')
  @OneToOne(() => TileOwner, (tileOwner) => tileOwner.siege)
  tile!: TileOwner; // FOREIGN KEY(tile) REFERENCES tile_owners(tile)

  @Column()
  attacker!: string; // TEXT,

  @Column()
  time!: number; // INTEGER,

  @Column()
  message!: string; // TEXT,

  @OneToMany(() => Pledge, (pledge) => pledge.siege)
  pledges!: Pledge[];
}
