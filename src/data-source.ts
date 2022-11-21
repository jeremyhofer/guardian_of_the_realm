import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { LoanDAO } from './dao/LoanDAO';
import { PactDAO } from './dao/PactDAO';
import { PlayerDataDAO } from './dao/PlayerDataDAO';
import { PledgeDAO } from './dao/PledgeDAO';
import { SiegeDAO } from './dao/SiegeDAO';
import { TileOwnerDAO } from './dao/TileOwnerDAO';
import { TrackerDAO } from './dao/TrackerDAO';
import { VoteDAO } from './dao/VoteDAO';
import { WarDAO } from './dao/WarDAO';
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

export const Database = {
  playerData: new PlayerDataDAO(AppDataSource.getRepository(PlayerData)),
  loan: new LoanDAO(AppDataSource.getRepository(Loan)),
  war: new WarDAO(AppDataSource.getRepository(War)),
  pact: new PactDAO(AppDataSource.getRepository(Pact)),
  vote: new VoteDAO(AppDataSource.getRepository(Vote)),
  tileOwner: new TileOwnerDAO(AppDataSource.getRepository(TileOwner)),
  siege: new SiegeDAO(AppDataSource.getRepository(Siege)),
  pledge: new PledgeDAO(AppDataSource.getRepository(Pledge)),
  tracker: new TrackerDAO(AppDataSource.getRepository(Tracker))
};
