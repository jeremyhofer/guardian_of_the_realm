import { Repository, UpdateResult } from 'typeorm';
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

  async updateTileOwner(house: string, tile: string): Promise<UpdateResult> {
    return await this._repository.update(tile, { house });
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
