import { Repository } from 'typeorm';
import { PlayerData } from 'src/entity/PlayerData';

export class PlayerDataDAO {
  constructor(private readonly _repository: Repository<PlayerData>) {}

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
