import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Tracker {
  @PrimaryGeneratedColumn()
  tracker_id!: number; // INTEGER PRIMARY KEY,

  @Column()
  name!: string; // TEXT,

  @Column()
  value!: number; // INTEGER,

  @Column({ nullable: true })
  text!: string; // TEXT
}
