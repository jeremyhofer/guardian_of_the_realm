import { DeleteResult, Repository, UpdateResult } from 'typeorm';
import { Tracker } from '../entity/Tracker';

export class TrackerDAO {
  constructor(private readonly _repository: Repository<Tracker>) {}

  async getTrackerByName(name: string): Promise<Tracker | null> {
    return await this._repository.findOneBy({
      name
    });
  }

  async getAllTrackerByName(name: string): Promise<Tracker[]> {
    return await this._repository.findBy({
      name
    });
  }

  async saveTracker(loan: Tracker): Promise<Tracker> {
    return await this._repository.save(loan);
  }

  async removeTracker(tracker: Tracker): Promise<DeleteResult> {
    return await this._repository.delete(tracker);
  }

  async updateTrackerByName(name: string, value: number): Promise<UpdateResult> {
    return await this._repository.update(name, { value });
  }
}
