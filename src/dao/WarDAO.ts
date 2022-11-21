import { DeleteResult, Repository } from 'typeorm';
import { War } from '../entity/War';

export class WarDAO {
  constructor(private readonly _repository: Repository<War>) {}

  async getAllWars(): Promise<War[]> {
    return await this._repository.find();
  }

  async saveWar(loan: War): Promise<War> {
    return await this._repository.save(loan);
  }

  async getWarBetweenHouses(house1: string, house2: string): Promise<War[]> {
    return await this._repository.findBy([
      {
        house_a: house1,
        house_b: house2
      },
      {
        house_a: house2,
        house_b: house1
      }
    ]);
  }

  async removeWar(warId: number): Promise<DeleteResult> {
    return await this._repository.delete({ war_id: warId });
  }
}
