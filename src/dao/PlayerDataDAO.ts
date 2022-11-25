import { defaultPlayer } from '../constants';
import { Repository, UpdateResult } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';

export class PlayerDataDAO {
  constructor(private readonly _repository: Repository<PlayerData>) {}

  /*
  "count_all_players_in_house": sql.prepare(`
    SELECT house, count(*) as num_members from player_data
    WHERE house != "" group by house
  `),
  TODO: test this query
  */
  async getPlayerCountsInAllHouses(): Promise<{ [key: string]: number }> {
    const queryResult = await this._repository.createQueryBuilder()
      .select('house')
      .addSelect('count(*) as numMembers')
      .where('playerData.house != ""')
      .groupBy('playerData.house')
      .getRawMany();

    return queryResult.reduce((acc, curr) => {
      acc[curr.house] = curr.numMembers;

      return acc;
    }, {});
  }

  async getAllPlayers(): Promise<PlayerData[]> {
    return await this._repository.find();
  }

  async getOrCreatePlayer(user: string): Promise<PlayerData> {
    const existing = await this._repository.findOneBy({ user });
    return existing !== null
      ? existing
      : this._repository.create({
      ...defaultPlayer,
      user
    });
  }

  // TODO: determine how to filter keys of PlayerData for only those with a number type
  async increment(playerData: PlayerData, property: keyof PlayerData, value: number): Promise<UpdateResult> {
    return await this._repository.increment(playerData, property, value);
  }

  // TODO: test this query
  async grantRolePayoutToAllPlayers(playerIds: string[], value: number): Promise<UpdateResult> {
    return await this._repository.update(playerIds, {
      money: () => `money + ${value}`
    });
  }

  // TODO: test this query
  async deductTroopCosts(menCost: number, shipCost: number): Promise<UpdateResult> {
    return await this._repository.createQueryBuilder()
      .update()
      .set({
        money: () => `money - (men * ${menCost}) - (ships * ${shipCost})`
      })
      .execute();
  }

  async setPlayer(playerData: PlayerData): Promise<PlayerData> {
    return await this._repository.save(playerData);
  }

  async saveMultiple(entities: PlayerData[]): Promise<PlayerData[]> {
    return await this._repository.save(entities);
  }

  async resetAllPlayers(): Promise<UpdateResult> {
    return await this._repository.createQueryBuilder()
      .update()
      .set({
        ...defaultPlayer
      })
      .execute();
  }
}
