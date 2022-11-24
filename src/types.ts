import { Loan } from './entity/Loan';
import { PlayerData } from './entity/PlayerData';
import { Pledge } from './entity/Pledge';
import { Siege } from './entity/Siege';
import { ArgTypes } from './enums';

export type Rank = 'baron' | 'earl' | 'duke' | 'unsworn';

export type Buildings = 'apothecary' | 'armory' | 'barrack' | 'blacksmith' | 'bordello' | 'monastery' | 'haunt' | 'weavery';

export type ArmyUnits = 'men' | 'ships';

export type StoreItemTypes = 'income' | 'title' | ArmyUnits;

export type AvailableStoreItems = Exclude<Rank, 'unsworn'> | Buildings | ArmyUnits;

export type Houses = 'Unsworn' | 'Scorpion' | 'Falcon' | 'Wolf' | 'Lion' | 'Bear' | 'Hydra' | 'Dragon';

export type AttackTypes = 'siege' | 'blockade';

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
  function: (...all: any) => CommandReturn | null | Promise<CommandReturn | null>
  args: string[]
  command_args: CommandArgs
  usage: string[]
  cooldown?: CooldownConfig
  allowed_channels?: string[]
  cooldown_from_start?: number
}

export type CommandDispatch = Record<string, CommandConfig>;

export interface CommandReturn {
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
        remove: string[]
      }
    }
  }
  loans?: {
    add?: {
      user: PlayerData
      amount_due: number
      time_due: string
    }
    remove?: Loan
    update?: Loan
  }
  sieges?: {
    update?: Siege
  }
  pledges?: {
    add?: Pledge
    remove?: Pledge
  }
  votes?: {
  }
  success: boolean
}
