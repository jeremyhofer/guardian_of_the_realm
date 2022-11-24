import { Repository } from 'typeorm';
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
  async countAllPlayersInHouse(): Promise<Array<{ house: string, num_members: number }>> {
    return await this._repository.createQueryBuilder()
      .select('house')
      .addSelect('count(*) as num_members')
      .where('playerData.house != ""')
      .groupBy('playerData.house')
      .getRawMany();
  }

  async getAllPlayers(): Promise<PlayerData[]> {
    return await this._repository.find();
  }

  async getPlayer(user: string): Promise<PlayerData | null> {
    return await this._repository.findOneBy({ user });
  }

  async setPlayer(playerData: PlayerData): Promise<PlayerData> {
    return await this._repository.save(playerData);
  }
}
