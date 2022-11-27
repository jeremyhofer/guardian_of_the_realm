import {
  ArmyUnits,
  AvailableStoreItems,
  Buildings,
  Houses,
  Rank,
  GameRoles,
  StoreItems,
  EmojiNames,
} from './types';

// custom emojis require the name:guild_emoji_id to be sent
export const emojis: Record<EmojiNames, string> = {
  ColumnA: '<:ColumnA:627721965116981251>',
  ColumnB: '<:ColumnB:627721989876088863>',
  ColumnC: '<:ColumnC:627722014664163358>',
  ColumnD: '<:ColumnD:627722038508781570>',
  ColumnE: '<:ColumnE:627722063133540353>',
  ColumnF: '<:ColumnF:627722087280410634>',
  ColumnG: '<:ColumnG:627722119278624788>',
  ColumnH: '<:ColumnH:628452628900085767>',
  HouseBear: '<:HouseBear:573636465402314782>',
  HouseDragon: '<:HouseDragon:573605618020122644>',
  HouseFalcon: '<:HouseFalcon:573605657199116288>',
  HouseHydra: '<:HouseHydra:573605687549100052>',
  HouseLion: '<:HouseLion:573605716649312286>',
  HouseScorpion: '<:HouseScorpion:573605751038148640>',
  HouseWolf: '<:HouseWolf:573605788124446721>',
  MenAtArms: '<:MenAtArms:627638751136448512>',
  MenAtArms2: '<:MenAtArms2:627638650175225886>',
  Row1: '<:Row1:627733297304174592>',
  Row10: '<:Row10:627733779628425217>',
  Row11: '<:Row11:627734941576331264>',
  Row12: '<:Row12:627735004973236225>',
  Row2: '<:Row2:627733360843948053>',
  Row3: '<:Row3:627733405764943872>',
  Row4: '<:Row4:627733451029872641>',
  Row5: '<:Row5:627733523754778624>',
  Row6: '<:Row6:627733585708843018>',
  Row7: '<:Row7:627733641686024193>',
  Row8: '<:Row8:627733686699425816>',
  Row9: '<:Row9:627733734036340741>',
  RowCompass: '<:RowCompass:627939971713466409>',
  TileBadland: '<:TileBadland:626172222658183220>',
  TileBear: '<:TileBear:643216329033121822>',
  TileDragon: '<:TileDragon:643216360612298754>',
  TileFalcon: '<:TileFalcon:643216389154537549>',
  TileField: '<:TileField:626172979373539348>',
  TileForest: '<:TileForest:626171896286806084>',
  TileHydra: '<:TileHydra:643216419554590730>',
  TileLion: '<:TileLion:643216451263660052>',
  TileMount: '<:TileMount:626172914693046273>',
  TileScorpion: '<:TileScorpion:643216480942686219>',
  TileSea: '<:TileSea:626169322322133004>',
  TileWolf: '<:TileWolf:643216538760904704>',
  PortBear: '<:PortBear:656627962241876028>',
  PortDragon: '<:PortDragon:656627994403799122>',
  PortFalcon: '<:PortFalcon:656628021595471909>',
  PortHydra: '<:PortHydra:656628045418856458>',
  PortLion: '<:PortLion:656628074955145235>',
  PortScorpion: '<:PortScorpion:656628116055392261>',
  PortUnsworn: '<:PortUnsworn:656628479160483922>',
  PortWolf: '<:PortWolf:656628138536599557>',
  Unsworn: '<:Unsworn:575488619389779979>',
  Warship: '<:Warship:627639570565038140>',
};

export const storeItems: Record<AvailableStoreItems, StoreItems> = {
  apothecary: {
    type: 'income',
    flavor:
      'Your local herbalist may not cure everyone, but at least a few recover to pay more taxes.',
    cost: 500,
  },
  mine: {
    type: 'income',
    flavor:
      'Ores are key to crafting the tools, armors, and weapons needed by your townsfolk and armies.',
    cost: 500,
  },
  baron: {
    type: 'title',
    flavor:
      "You've scraped together a sizeable pile of coins. Now it's time to pitch tents for up to 300 men, and docks for 30 ships.",
    cost: 3000,
  },
  barrack: {
    type: 'income',
    flavor:
      'A warm hearth, and stout walls reassure your people that they are protected by a strong lord, which increases tax revenues.',
    cost: 1500,
  },
  blacksmith: {
    type: 'income',
    flavor:
      'Nobles continually make war, but wars require weapons, something a blacksmith provides.',
    cost: 1500,
  },
  bordello: {
    type: 'income',
    flavor:
      'The Matriarchy seek the finer things of life, and most especially during war, their caring touch is need.',
    cost: 1000,
  },
  duke: {
    type: 'title',
    flavor:
      "You are without peer in the land, best watch your back. Good thing you've got barracks for 1000 men, and captains for 100 ships.",
    cost: 10000,
    requires: 'earl',
  },
  earl: {
    type: 'title',
    flavor:
      'People around these lands grow envious. You expand your castle with rooms for up to 600 men, and supplies for 60 ships.',
    cost: 6000,
    requires: 'baron',
  },
  men: {
    type: 'men',
    flavor:
      "Ugly, smelly and likely to rip off your head, they're exactly what you need to win battles.",
    cost: 100,
  },
  monastery: {
    type: 'income',
    flavor:
      'The Patriarchy reject common indulgences and vices. Their Inquisitions into Tainted matters are swift and violent.',
    cost: 1000,
  },
  lumber: {
    type: 'income',
    flavor:
      'A bountiful forest and a productive lumber mill are key to building the infrastructure of a successful kingdom.',
    cost: 1000,
  },
  ships: {
    type: 'ships',
    flavor:
      'These fine vessels are build by the fairly reliable craftsmen of the shipwrights guild.',
    cost: 1000,
  },
  farm: {
    type: 'income',
    flavor: 'Every noble should have a fertile farm to supply their family.',
    cost: 500,
  },
};

// TODO: consider changing up mappings and referencing of roleId in guild <-> name <-> troop
export const gameRoles: GameRoles = {
  '625905668263510017': ['guardian', 'realm'],
  '572290551357898781': ['assassins', 'scorpion'],
  '572288816652484608': ['bannermen', 'falcon'],
  '572291484288548929': ['berserkers', 'wolf'],
  '572288999843168266': ['freelancers', 'lion'],
  '572288151419355136': ['knights', 'bear'],
  '572289104742580254': ['shinobi', 'hydra'],
  '572288492101435408': ['ronin', 'dragon'],
  '575048350915756050': ['barrack'],
  '575048286059102209': ['mine'],
  '629752243440058388': ['monastery'],
  '596111896633933860': ['bordello'],
  '596192462582710272': ['lumber'],
  '593580957324279808': ['farm'],
  '587764855067377674': ['earl'],
  '584864539259043912': ['duke'],
  '575048205234995225': ['blacksmith'],
  '587764622296219651': ['baron'],
  '629752308011630605': ['apothecary'],
};

export const houses: string[] = [
  '625905668263510017',
  '572290551357898781',
  '572288816652484608',
  '572291484288548929',
  '572288999843168266',
  '572288151419355136',
  '572289104742580254',
  '572288492101435408',
];

export const houseTiles: { [key: string]: Houses } = {
  '625905668263510017': 'Unsworn',
  '572290551357898781': 'Scorpion',
  '572288816652484608': 'Falcon',
  '572291484288548929': 'Wolf',
  '572288999843168266': 'Lion',
  '572288151419355136': 'Bear',
  '572289104742580254': 'Hydra',
  '572288492101435408': 'Dragon',
};

export const dailyPayouts: Record<Buildings, number> = {
  apothecary: 500,
  mine: 500,
  barrack: 1500,
  blacksmith: 1500,
  bordello: 1000,
  lumber: 1000,
  monastery: 1000,
  farm: 500,
};

export const roleTroopLimits: Record<Rank, number> = {
  baron: 300,
  earl: 600,
  duke: 1000,
  unsworn: 100,
};

export const roleShipLimits: Record<Rank, number> = {
  baron: 30,
  earl: 60,
  duke: 100,
  unsworn: 10,
};

export const dailyCosts: Record<ArmyUnits, number> = {
  men: 2,
  ships: 20,
};

// TODO: change all props to camelCase
export const replyChannels: { [key: string]: string } = {
  command_tent: '572265598193500160',
  battle_reports: '597614956732612613',
  overworld: '629077475745595402',
};

export const blockedChannels: string[] = [
  '592985410536210433',
  '572265535828393999',
  '628759338579918856',
];

export const playerInteractChannels: string[] = ['572265598193500160'];

export const developerRole = '572264297883762688';

// TODO: change all props to camelCase
export const timeoutLengths: { [key: string]: number } = {
  siege_blockade: 24,
  vote_expiration: 8,
  payout_interval: 12,
  arson: 12,
  pirate: 24,
  raid: 24,
  scandal: 48,
  spy: 1,
  thief: 24,
  trade: 24,
  pray: 1,
  subvert: 12,
  train: 12,
  work: 6,
};

// TODO: change all props to camelCase
export const rewardPayoutsPenalties: { [key: string]: number } = {
  port_daily: 3000,
  arson_penalty_min: 200,
  arson_penalty_max: 1000,
  pirate_reward_min: 2000,
  pirate_reward_max: 3000,
  pirate_success_attacker_loss_min: 0,
  pirate_success_attacker_loss_max: 5,
  pirate_success_defender_loss_min: 5,
  pirate_success_defender_loss_max: 10,
  pirate_fail_attacker_loss_min: 5,
  pirate_fail_attacker_loss_max: 8,
  pirate_fail_defender_loss_min: 3,
  pirate_fail_defender_loss_max: 6,
  raid_reward_min: 2000,
  raid_reward_max: 3000,
  raid_success_attacker_loss_min: 0,
  raid_success_attacker_loss_max: 50,
  raid_success_defender_loss_min: 50,
  raid_success_defender_loss_max: 100,
  raid_fail_attacker_loss_min: 50,
  raid_fail_attacker_loss_max: 80,
  raid_fail_defender_loss_min: 30,
  raid_fail_defender_loss_max: 60,
  scandal_penalty_min: 200,
  scandal_penalty_max: 1000,
  spy_cost: 200,
  thief_success_percent_min: 5,
  thief_success_percent_max: 15,
  thief_penalty_min: 100,
  thief_penalty_max: 500,
  trade_trader_reward_min: 200,
  trade_trader_reward_max: 250,
  trade_tradee_reward_min: 150,
  trade_tradee_reward_max: 200,
  pray_reward_min: 0,
  pray_reward_max: 200,
  subvert_reward_min: 1000,
  subvert_reward_max: 4000,
  subvert_penalty_min: 200,
  subvert_penalty_max: 500,
  train_reward_min: 1,
  train_reward_max: 20,
  train_penalty_min: 10,
  train_penalty_max: 100,
  work_reward_min: 500,
  work_reward_max: 2000,
};
