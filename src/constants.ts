import { PlayerData } from './entity/PlayerData';

export const defaultPlayer: Omit<PlayerData, 'loans' | 'votes' | 'pledges' | 'user'> = {
  house: '',
  men: 20,
  ships: 2,
  money: 2000,
  arson_last_time: 0,
  pirate_last_time: 0,
  pray_last_time: 0,
  raid_last_time: 0,
  smuggle_last_time: 0,
  scandal_last_time: 0,
  spy_last_time: 0,
  subvert_last_time: 0,
  thief_last_time: 0,
  train_last_time: 0,
  trade_last_time: 0,
  work_last_time: 0
};
