import { Loan } from './entity/Loan';
import { PlayerData } from './entity/PlayerData';
import { Pledge } from './entity/Pledge';
import { Siege } from './entity/Siege';
import { Vote } from './entity/Vote';
import { ArgTypes } from './enums';

export type Rank = 'baron' | 'earl' | 'duke' | 'unsworn';

export type Buildings = 'apothecary' | 'armory' | 'barrack' | 'blacksmith' | 'bordello' | 'monastery' | 'haunt' | 'weavery';

export type ArmyUnits = 'men' | 'ships';

export type StoreItemTypes = 'income' | 'title' | ArmyUnits;

export type AvailableStoreItems = Exclude<Rank, 'unsworn'> | Buildings | ArmyUnits;

export type Houses = 'Unsworn' | 'Scorpion' | 'Falcon' | 'Wolf' | 'Lion' | 'Bear' | 'Hydra' | 'Dragon';

export type AttackTypes = 'siege' | 'blockade';

export type EmojiNames =
  'ColumnA' |
  'ColumnB' |
  'ColumnC' |
  'ColumnD' |
  'ColumnE' |
  'ColumnF' |
  'ColumnG' |
  'ColumnH' |
  'HouseBear' |
  'HouseDragon' |
  'HouseFalcon' |
  'HouseHydra' |
  'HouseLion' |
  'HouseScorpion' |
  'HouseWolf' |
  'MenAtArms' |
  'MenAtArms2' |
  'Row1' |
  'Row10' |
  'Row11' |
  'Row12' |
  'Row2' |
  'Row3' |
  'Row4' |
  'Row5' |
  'Row6' |
  'Row7' |
  'Row8' |
  'Row9' |
  'RowCompass' |
  'TileBadland' |
  'TileBear' |
  'TileDragon' |
  'TileFalcon' |
  'TileField' |
  'TileForest' |
  'TileHydra' |
  'TileLion' |
  'TileMount' |
  'TileScorpion' |
  'TileSea' |
  'TileWolf' |
  'PortBear' |
  'PortDragon' |
  'PortFalcon' |
  'PortHydra' |
  'PortLion' |
  'PortScorpion' |
  'PortUnsworn' |
  'PortWolf' |
  'Unsworn' |
  'Warship';

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
  field: string
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
