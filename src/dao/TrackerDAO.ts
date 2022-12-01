import { DeleteResult, InsertResult, Repository, UpdateResult } from 'typeorm';
import { Tracker } from '../entity/Tracker';

export class TrackerDAO {
  constructor(private readonly _repository: Repository<Tracker>) {}

  async getTrackerByName(name: string): Promise<Tracker | null> {
    return await this._repository.findOneBy({
      name,
    });
  }

  async getAllTrackerByName(name: string): Promise<Tracker[]> {
    return await this._repository.findBy({
      name,
    });
  }

  async saveTracker(loan: Tracker): Promise<Tracker> {
    return await this._repository.save(loan);
  }

  async createMapTracker(messageId: string): Promise<Tracker> {
    const newTracker = this._repository.create({
      text: messageId,
      value: 0,
      name: 'map',
    });
    return await this._repository.save(newTracker);
  }

  async getOrCreateTrackerByName(name: string): Promise<Tracker> {
    const tracker = await this._repository.findOneBy({ name });

    return tracker === null ? this._repository.create({ name }) : tracker;
  }

  async insertTracker(pTracker: Partial<Tracker>): Promise<InsertResult> {
    return await this._repository.insert(pTracker);
  }

  async removeTracker(tracker: Tracker): Promise<DeleteResult> {
    return await this._repository.delete(tracker.tracker_id);
  }

  async updateTrackerByName(
    name: string,
    value: number
  ): Promise<UpdateResult> {
    return await this._repository.update({ name }, { value });
  }
}
