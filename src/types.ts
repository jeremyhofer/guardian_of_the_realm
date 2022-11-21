import { ArgTypes } from './enums';

export type Rank = 'baron' | 'earl' | 'duke' | 'unsworn';

export type Buildings = 'apothecary' | 'armory' | 'barrack' | 'blacksmith' | 'bordello' | 'monastery' | 'haunt' | 'weavery';

export type ArmyUnits = 'men' | 'ships';

export type StoreItemTypes = 'income' | 'title' | ArmyUnits;

export type AvailableStoreItems = Exclude<Rank, 'unsworn'> | Buildings | ArmyUnits;

export type Houses = 'Unsworn' | 'Scorpion' | 'Falcon' | 'Wolf' | 'Lion' | 'Bear' | 'Hydra' | 'Dragon';

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
