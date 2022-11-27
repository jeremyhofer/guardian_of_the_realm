import { Loan } from './entity/Loan';
import { PlayerData } from './entity/PlayerData';
import { Pledge } from './entity/Pledge';
import { Siege } from './entity/Siege';
import { Vote } from './entity/Vote';
import { ArgTypes } from './enums';

export const rank = ['baron', 'earl', 'duke', 'unsworn'] as const;
export type Rank = typeof rank[number];

export const buildings = ['apothecary', 'armory', 'barrack', 'blacksmith', 'bordello', 'monastery', 'haunt', 'weavery'];
export type Buildings = typeof buildings[number];

export const armyUnits = ['men', 'ships'];
export type ArmyUnits = typeof armyUnits[number];

export const storeItemTypes = ['income', 'title', ...armyUnits];
export type StoreItemTypes = typeof storeItemTypes[number];

export const availableStoreItems = [...rank.filter((r) => r !== 'unsworn'), ...buildings, ...armyUnits];
export type AvailableStoreItems = typeof availableStoreItems[number];

export type Houses = 'Unsworn' | 'Scorpion' | 'Falcon' | 'Wolf' | 'Lion' | 'Bear' | 'Hydra' | 'Dragon';

export type AttackTypes = 'siege' | 'blockade';

export const CooldownCommands = [
  'arson',
  'pirate',
  'pray',
  'raid',
  'scandal',
  'spy',
  'subvert',
  'thief',
  'train',
  'trade',
  'work'
] as const;

export type CooldownCommandNames = typeof CooldownCommands[number];

export type CooldownCommandFields = `${CooldownCommandNames}_last_time`;

export const Emojis = [
  'ColumnA',
  'ColumnB',
  'ColumnC',
  'ColumnD',
  'ColumnE',
  'ColumnF',
  'ColumnG',
  'ColumnH',
  'HouseBear',
  'HouseDragon',
  'HouseFalcon',
  'HouseHydra',
  'HouseLion',
  'HouseScorpion',
  'HouseWolf',
  'MenAtArms',
  'MenAtArms2',
  'Row1',
  'Row10',
  'Row11',
  'Row12',
  'Row2',
  'Row3',
  'Row4',
  'Row5',
  'Row6',
  'Row7',
  'Row8',
  'Row9',
  'RowCompass',
  'TileBadland',
  'TileBear',
  'TileDragon',
  'TileFalcon',
  'TileField',
  'TileForest',
  'TileHydra',
  'TileLion',
  'TileMount',
  'TileScorpion',
  'TileSea',
  'TileWolf',
  'PortBear',
  'PortDragon',
  'PortFalcon',
  'PortHydra',
  'PortLion',
  'PortScorpion',
  'PortUnsworn',
  'PortWolf',
  'Unsworn',
  'Warship'
];

export type EmojiNames = typeof Emojis[number];

export interface StoreItems {
  type: StoreItemTypes
  flavor: string
  cost: number
  requires?: Rank
}

export interface GameRoles {
  [key: string]: string[]
}

export type CommandArgs = ArgTypes[][];

export interface ParsedArgs {
  values: any[]
  types: ArgTypes[]
};

export interface CooldownConfig {
  time: number
  field: CooldownCommandFields
  reply: string
}

export interface CommandConfig {
  function: (...all: any) => Promise<CommandReturn | null> | Promise<void>
  args: string[]
  command_args: CommandArgs
  usage: string[]
  cooldown?: CooldownConfig
  allowed_channels?: string[]
  cooldown_from_start?: number
}

export type CommandDispatch = Record<string, CommandConfig>;

export interface CommandReturn {
  enableGame?: boolean
  reply: string
  update?: {
    playerData?: PlayerData
    playerMention?: PlayerData
    roles?: {
      player?: {
        add: string[]
        remove: string[]
      }
      other_player?: {
        id: string
        add: string[]
        remove: string[]
      }
    }
  }
  loans?: {
    add?: Loan
    remove?: Loan
    update?: Loan
  }
  sieges?: {
    add?: Siege
    update?: Siege
  }
  pledges?: {
    add?: Pledge
    remove?: Pledge
  }
  votes?: {
    add?: Vote
  }
  send?: {
    message?: string
    channel?: string
  }
  map?: {
    message: string
    embed: any
  }
  success: boolean
}
