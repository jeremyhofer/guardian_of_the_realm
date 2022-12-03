import { TileOwner } from '../entity/TileOwner';
import {
  DeleteResult,
  InsertResult,
  LessThanOrEqual,
  Repository,
  UpdateResult,
} from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Siege } from '../entity/Siege';

export class SiegeDAO {
  constructor(private readonly _repository: Repository<Siege>) {}

  async countHouseSieges(house: string): Promise<number> {
    return await this._repository.countBy({ attacker: house });
  }

  async getAllSieges(): Promise<Siege[]> {
    return await this._repository.find({
      relations: {
        tile: true,
      },
    });
  }

  async getSiegeById(siegeId: number): Promise<Siege | null> {
    return await this._repository.findOneBy({
      siege_id: siegeId,
    });
  }

  async getSiegeByTile(tile: string): Promise<Siege | null> {
    return await this._repository.findOneBy({
      tile: tile as any,
    });
  }

  async getAllSiegeIdBetweenTwoHouses(
    houseA: string,
    houseB: string
  ): Promise<Siege[]> {
    return await this._repository.find({
      relations: {
        tile: true,
        pledges: {
          user: true,
        },
      },
      where: [
        {
          attacker: houseA,
          tile: {
            house: houseB,
          },
        },
        {
          attacker: houseB,
          tile: {
            house: houseA,
          },
        },
      ],
    });
  }

  async getExpiredSiege(expireTime: number): Promise<Siege | null> {
    return await this._repository.findOne({
      relations: {
        pledges: {
          user: true,
        },
        tile: true,
      },
      where: {
        time: LessThanOrEqual(expireTime),
      },
    });
  }

  async getAllSiegesWithPlayerPledges(user: PlayerData): Promise<Siege[]> {
    return await this._repository.find({
      relations: {
        pledges: true,
        tile: true,
      },
      where: {
        pledges: {
          user,
        },
      },
    });
  }

  createSiege(pSiege: Partial<Siege>): Siege {
    return this._repository.create(pSiege);
  }

  async insertSiege(pSiege: Partial<Siege>): Promise<InsertResult> {
    return await this._repository.insert(pSiege);
  }

  async saveSiege(loan: Siege): Promise<Siege> {
    return await this._repository.save(loan);
  }

  async updateSiegeMessage(
    siegeId: number,
    message: string
  ): Promise<UpdateResult> {
    return await this._repository.update(siegeId, { message });
  }

  async updateSiegeMessageForTile(
    tile: TileOwner,
    message: string
  ): Promise<UpdateResult> {
    return await this._repository.update({ tile }, { message });
  }

  async removeSiege(siege: Siege): Promise<DeleteResult> {
    return await this._repository.delete(siege.siege_id);
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
