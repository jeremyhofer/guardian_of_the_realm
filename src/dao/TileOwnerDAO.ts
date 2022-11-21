import { Repository } from 'typeorm';
import { TileOwner } from '../entity/TileOwner';

export class TileOwnerDAO {
  constructor(private readonly _repository: Repository<TileOwner>) {}

  async getAllTiles(): Promise<TileOwner[]> {
    return await this._repository.find();
  }

  async getTileOwner(tile: string): Promise<TileOwner[]> {
    return await this._repository.findBy({
      tile
    });
  }

  async getPorts(): Promise<TileOwner[]> {
    return await this._repository.findBy({
      type: 'port'
    });
  }
}
