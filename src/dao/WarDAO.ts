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

  async createWar(pWar: Partial<War>): Promise<War> {
    return await this._repository.save(this._repository.create(pWar));
  }

  async createMultipleWars(houseMapping: Array<[string, string]>): Promise<War[]> {
    return await this._repository.save(
      houseMapping.map(
        ([house1, house2]) => this._repository.create({ house_a: house1, house_b: house2 })
      )
    );
  }

  async getWarBetweenHouses(house1: string, house2: string): Promise<War | null> {
    return await this._repository.findOneBy([
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

  async removeWarBetweenHouses(house1: string, house2: string): Promise<DeleteResult> {
    return await this._repository.createQueryBuilder()
      .delete()
      .where('(war.house_a = :house1 AND war.house_b = :house2) OR (war.house_a = :house2 AND war.house_b = :house1)', { house1, house2 })
      .execute();
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
