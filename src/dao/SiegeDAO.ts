import { DeleteResult, LessThanOrEqual, Repository, UpdateResult } from 'typeorm';
import { Siege } from '../entity/Siege';
import { TileOwner } from '../entity/TileOwner';

export class SiegeDAO {
  constructor(private readonly _repository: Repository<Siege>) {}

  async countHouseSieges(house: string): Promise<number> {
    return await this._repository.countBy({ attacker: house });
  }

  async getAllSieges(): Promise<Siege[]> {
    return await this._repository.find({
      relations: {
        tile: true
      }
    });
  }

  async getSiegeById(siegeId: number): Promise<Siege | null> {
    return await this._repository.findOneBy({
      siege_id: siegeId
    });
  }

  async getSiegeOnTile(tileOwner: TileOwner): Promise<Siege | null> {
    return await this._repository.findOneBy({
      tile: tileOwner
    });
  }

  async getAllSiegeIdBetweenTwoHouses(houseA: string, houseB: string): Promise<Siege[]> {
    return await this._repository.find({
      relations: {
        tile: true
      },
      where: [
        {
          attacker: houseA,
          tile: {
            house: houseB
          }
        },
        {
          attacker: houseB,
          tile: {
            house: houseA
          }
        }
      ]
    });
  }

  async getExpiredSiege(expireTime: number): Promise<Siege[]> {
    return await this._repository.findBy({
      time: LessThanOrEqual(expireTime)
    });
  }

  async saveSiege(loan: Siege): Promise<Siege> {
    return await this._repository.save(loan);
  }

  async updateSiegeMessage(siegeId: number, message: string): Promise<UpdateResult> {
    return await this._repository.update(siegeId, { message });
  }

  async removeSiege(siegeId: number): Promise<DeleteResult> {
    return await this._repository.delete({ siege_id: siegeId });
  }
}