import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Pact {
  @PrimaryGeneratedColumn()
  pact_id!: number; // INTEGER PRIMARY KEY,

  @Column()
  house_a!: string; // TEXT,

  @Column()
  house_b!: string; // TEXT,
}
