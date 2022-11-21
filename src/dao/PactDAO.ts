import { DeleteResult, Repository } from 'typeorm';
import { Pact } from '../entity/Pact';

export class PactDAO {
  constructor(private readonly _repository: Repository<Pact>) {}

  async getAllPacts(): Promise<Pact[]> {
    return await this._repository.find();
  }

  async getPactBetweenHouses(house1: string, house2: string): Promise<Pact[]> {
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

  async savePact(loan: Pact): Promise<Pact> {
    return await this._repository.save(loan);
  }

  async removePact(pactId: number): Promise<DeleteResult> {
    return await this._repository.delete({ pact_id: pactId });
  }
}
