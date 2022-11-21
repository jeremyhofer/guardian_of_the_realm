import { AppDataSource } from './data-source';
import { TileOwner } from './entity/TileOwner';
import { Tracker } from './entity/Tracker';
import { War } from './entity/War';

const newTracker = (name: string, value: number): Tracker => {
  const tracker = new Tracker();
  tracker.name = name;
  tracker.value = value;

  return tracker;
};

const newTileOwner = (tile: string, house: string, type: string): TileOwner => {
  const tileOwner = new TileOwner();
  tileOwner.tile = tile;
  tileOwner.house = house;
  tileOwner.type = type;

  return tileOwner;
};

const newWar = (houseA: string, houseB: string): War => {
  const war = new War();
  war.house_a = houseA;
  war.house_b = houseB;

  return war;
};

AppDataSource.initialize().then(async () => {
  console.log('Configuring trackers');
  const trackers = [
    newTracker('payout_time', 0),
    newTracker('game_active', 1),
    newTracker('game_start', 0)
  ];
  await AppDataSource.manager.save(trackers);

  console.log('Configuring initial tile owners');
  const tileOwners = [
    newTileOwner('c2', '572288999843168266', 'castle'),
    newTileOwner('b3', '572288816652484608', 'castle'),
    newTileOwner('g3', '572288151419355136', 'castle'),
    newTileOwner('d4', '572290551357898781', 'castle'),
    newTileOwner('f5', '572289104742580254', 'castle'),
    newTileOwner('g5', '572288999843168266', 'castle'),
    newTileOwner('b6', '572288492101435408', 'castle'),
    newTileOwner('d6', '572288492101435408', 'castle'),
    newTileOwner('e6', '572290551357898781', 'castle'),
    newTileOwner('d7', '572289104742580254', 'castle'),
    newTileOwner('g9', '572288816652484608', 'castle'),
    newTileOwner('b10', '572291484288548929', 'castle'),
    newTileOwner('c10', '572288151419355136', 'castle'),
    newTileOwner('d10', '572291484288548929', 'castle'),
    newTileOwner('h1', '625905668263510017', 'port'),
    newTileOwner('a12', '625905668263510017', 'port'),
    newTileOwner('h12', '625905668263510017', 'port')
  ];
  await AppDataSource.manager.save(tileOwners);

  console.log('Configuring wars');
  const wars = [
    newWar('572290551357898781', '572288816652484608'),
    newWar('572290551357898781', '572291484288548929'),
    newWar('572290551357898781', '572288999843168266'),
    newWar('572290551357898781', '572288151419355136'),
    newWar('572290551357898781', '572289104742580254'),
    newWar('572290551357898781', '572288492101435408'),
    newWar('572288816652484608', '572291484288548929'),
    newWar('572288816652484608', '572288999843168266'),
    newWar('572288816652484608', '572288151419355136'),
    newWar('572288816652484608', '572289104742580254'),
    newWar('572288816652484608', '572288492101435408'),
    newWar('572291484288548929', '572288999843168266'),
    newWar('572291484288548929', '572288151419355136'),
    newWar('572291484288548929', '572289104742580254'),
    newWar('572291484288548929', '572288492101435408'),
    newWar('572288999843168266', '572288151419355136'),
    newWar('572288999843168266', '572289104742580254'),
    newWar('572288999843168266', '572288492101435408'),
    newWar('572288151419355136', '572289104742580254'),
    newWar('572288151419355136', '572288492101435408'),
    newWar('572289104742580254', '572288492101435408'),
    newWar('572290551357898781', '625905668263510017'),
    newWar('572288816652484608', '625905668263510017'),
    newWar('572288816652484608', '625905668263510017'),
    newWar('572291484288548929', '625905668263510017'),
    newWar('572288999843168266', '625905668263510017'),
    newWar('572288151419355136', '625905668263510017'),
    newWar('572289104742580254', '625905668263510017')
  ];
  await AppDataSource.manager.save(wars);

  // console.log('Loading users from the database...');
  // const users = await AppDataSource.manager.find(User);
  // console.log('Loaded users: ', users);
  // console.log('Here you can setup and run express / fastify / any other framework.');
}).catch(error => console.log(error));
