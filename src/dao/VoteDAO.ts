import { DeleteResult, LessThanOrEqual, Like, Repository } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Vote } from '../entity/Vote';

export class VoteDAO {
  constructor(private readonly _repository: Repository<Vote>) {}

  async getPlayerVoteByType(user: PlayerData, type: string): Promise<Vote[]> {
    return await this._repository.findBy({
      user,
      type
    });
  }

  async getExpiredVotesByType(expireTime: number, type: string): Promise<Vote[]> {
    return await this._repository.findBy({
      time: LessThanOrEqual(expireTime),
      type
    });
  }

  async getExpiredTruceVote(expireTime: number): Promise<Vote[]> {
    return await this._repository.findBy({
      time: LessThanOrEqual(expireTime),
      type: Like('truce%')
    });
  }

  async getExpiredPactVote(expireTime: number): Promise<Vote[]> {
    return await this._repository.findBy({
      time: LessThanOrEqual(expireTime),
      type: Like('pact%')
    });
  }

  async getExpiredWarVote(expireTime: number): Promise<Vote[]> {
    return await this._repository.findBy({
      time: LessThanOrEqual(expireTime),
      type: Like('war%')
    });
  }

  async getVotesForHouseByType(house: string, type: string): Promise<Vote[]> {
    return await this._repository.find({
      relations: {
        user: true
      },
      where: {
        type,
        user: {
          house
        }
      }
    });
  }

  async saveVote(loan: Vote): Promise<Vote> {
    return await this._repository.save(loan);
  }

  async removeVote(voteId: number): Promise<DeleteResult> {
    return await this._repository.delete({ vote_id: voteId });
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
