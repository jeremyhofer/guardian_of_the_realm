import { DeleteResult, Repository } from 'typeorm';
import { Pact } from '../entity/Pact';

export class PactDAO {
  constructor(private readonly _repository: Repository<Pact>) {}

  async getAllPacts(): Promise<Pact[]> {
    return await this._repository.find();
  }

  async getPactBetweenHouses(
    house1: string,
    house2: string
  ): Promise<Pact | null> {
    return await this._repository.findOneBy([
      {
        house_a: house1,
        house_b: house2,
      },
      {
        house_a: house2,
        house_b: house1,
      },
    ]);
  }

  async savePact(loan: Pact): Promise<Pact> {
    return await this._repository.save(loan);
  }

  async createPact(pPact: Partial<Pact>): Promise<Pact> {
    return await this._repository.save(this._repository.create(pPact));
  }

  async removePactBetweenHouses(
    house1: string,
    house2: string
  ): Promise<DeleteResult> {
    return await this._repository
      .createQueryBuilder()
      .delete()
      .where(
        '(pact.house_a = :house1 AND pact.house_b = :house2) OR (pact.house_a = :house2 AND pact.house_b = :house1)',
        { house1, house2 }
      )
      .execute();
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
