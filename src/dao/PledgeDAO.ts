import { DeleteResult, Repository } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Siege } from '../entity/Siege';
import { Pledge } from '../entity/Pledge';

export class PledgeDAO {
  constructor(private readonly _repository: Repository<Pledge>) {}

  async getPlayerPledgeForSiege(
    user: PlayerData,
    siege: Siege
  ): Promise<Pledge | null> {
    return await this._repository.findOne({
      relations: {
        user: true,
        siege: true
      },
      where: {
        // TODO: any cast, need I say more?
        user: user.user as any,
        siege: siege.siege_id as any
      }
    });
  }

  async getPlayerPledges(
    user: PlayerData,
  ): Promise<Pledge[]> {
    return await this._repository.find({
      relations: {
        siege: {
          tile: true
        }
      },
      where: {
        // TODO: any cast, need I say more?
        user: user.user as any
      }
    });
  }

  async getAllPledgesForSiege(siege: Siege): Promise<Pledge[]> {
    return await this._repository.find({
      relations: {
        user: true
      },
      where: {
        siege
      }
    });
  }

  async savePledge(loan: Pledge): Promise<Pledge> {
    return await this._repository.save(loan);
  }

  async removePledge(pledge: Pledge): Promise<DeleteResult> {
    return await this._repository.delete(pledge.pledge_id);
  }

  async removePledgesForSiege(siege: Siege): Promise<DeleteResult> {
    return await this._repository.delete({ siege });
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
