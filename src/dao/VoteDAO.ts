import {
  DeleteResult,
  InsertResult,
  LessThanOrEqual,
  Like,
  Repository,
} from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Vote } from '../entity/Vote';

export class VoteDAO {
  constructor(private readonly _repository: Repository<Vote>) {}

  async getPlayerVotesAgainstHouseByTypes(
    player: PlayerData,
    targetHouse: string,
    types: string[]
  ): Promise<Vote[]> {
    return await this._repository
      .createQueryBuilder('vote')
      .select()
      .leftJoin('vote.user', 'user', 'user.user = :user', { user: player.user })
      .where('vote.type IN(:...types)', { types })
      .andWhere('vote.choice = :targetHouse', { targetHouse })
      .getMany();
  }

  async getExpiredPactVote(expireTime: number): Promise<Vote | null> {
    return await this._repository.findOne({
      relations: {
        user: true,
      },
      where: {
        time: LessThanOrEqual(expireTime),
        type: Like('pact%'),
      },
    });
  }

  async getExpiredWarVote(expireTime: number): Promise<Vote | null> {
    return await this._repository.findOne({
      relations: {
        user: true,
      },
      where: {
        time: LessThanOrEqual(expireTime),
        type: Like('war%'),
      },
    });
  }

  async getVotesForHouseAgainstHouseByTypes(
    sourceHouse: string,
    targetHouse: string,
    types: string[]
  ): Promise<Array<Pick<Vote, 'vote_id' | 'type'>>> {
    return await this._repository
      .createQueryBuilder('vote')
      .select('vote.vote_id as vote_id')
      .addSelect('vote.type as type')
      .leftJoin('vote.user', 'user', 'user.house = :sourceHouse', {
        sourceHouse,
      })
      .where('vote.type IN(:...types)', { types })
      .andWhere('vote.choice = :targetHouse', { targetHouse })
      .getRawMany();
  }

  createVote(pVote: Partial<Vote>): Vote {
    return this._repository.create(pVote);
  }

  async insertVote(pVote: Partial<Vote>): Promise<InsertResult> {
    return await this._repository.insert(pVote);
  }

  async saveVote(loan: Vote): Promise<Vote> {
    return await this._repository.save(loan);
  }

  async removeMultiple(voteIds: number[]): Promise<DeleteResult> {
    return await this._repository.delete(voteIds);
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
