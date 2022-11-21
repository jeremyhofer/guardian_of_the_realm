import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PlayerData } from './entity/PlayerData';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: true,
  logging: false,
  entities: [PlayerData],
  migrations: [],
  subscribers: []
});
