import { DeleteResult, Repository } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Siege } from '../entity/Siege';
import { Pledge } from '../entity/Pledge';

export class PledgeDAO {
  constructor(private readonly _repository: Repository<Pledge>) {}

  async getPlayerPledgeForSiege(user: PlayerData, siege: Siege): Promise<Pledge | null> {
    return await this._repository.findOneBy({
      user,
      siege
    });
  }

  async getAllPledgesForSiege(siege: Siege): Promise<Pledge[]> {
    return await this._repository.findBy({
      siege
    });
  }

  async savePledge(loan: Pledge): Promise<Pledge> {
    return await this._repository.save(loan);
  }

  async removePledge(pledgeId: number): Promise<DeleteResult> {
    return await this._repository.delete({ pledge_id: pledgeId });
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
