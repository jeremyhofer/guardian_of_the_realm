import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class War {
  @PrimaryGeneratedColumn()
  war_id!: number; // INTEGER PRIMARY KEY,

  @Column()
  house_a!: string; // TEXT,

  @Column()
  house_b!: string; // TEXT,
}
