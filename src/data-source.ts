import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Loan } from './entity/Loan';
import { Pact } from './entity/Pact';
import { PlayerData } from './entity/PlayerData';
import { Pledge } from './entity/Pledge';
import { Siege } from './entity/Siege';
import { TileOwner } from './entity/TileOwner';
import { Tracker } from './entity/Tracker';
import { Vote } from './entity/Vote';
import { War } from './entity/War';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: true,
  logging: false,
  entities: [PlayerData, Loan, War, Pact, Vote, TileOwner, Siege, Pledge, Tracker],
  migrations: [],
  subscribers: []
});
