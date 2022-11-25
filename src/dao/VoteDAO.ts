import { DeleteResult, LessThanOrEqual, Like, Repository } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Vote } from '../entity/Vote';

export class VoteDAO {
  constructor(private readonly _repository: Repository<Vote>) {}

  async getPlayerHasVoteAgainstHouseByTypes(player: PlayerData, targetHouse: string, types: string[]): Promise<Vote[]> {
    return await this._repository.createQueryBuilder()
      .select('COUNT(*) as voteCount')
      .leftJoin(
        'vote.user',
        'user',
        'user.user = :user',
        { user: player.user }
      )
      .where('vote.type IN(:...types)', { types })
      .andWhere('vote.choice = :targetHouse', { targetHouse })
      .groupBy('vote.type')
      .getMany();
  }

  async getExpiredPactVote(expireTime: number): Promise<Vote | null> {
    return await this._repository.findOne({
      relations: {
        user: true
      },
      where: {
        time: LessThanOrEqual(expireTime),
        type: Like('pact%')
      }
    });
  }

  async getExpiredWarVote(expireTime: number): Promise<Vote | null> {
    return await this._repository.findOne({
      relations: {
        user: true
      },
      where: {
        time: LessThanOrEqual(expireTime),
        type: Like('war%')
      }
    });
  }

  // TODO: test this
  async getVotesForHouseAgainstHouseByTypes(sourceHouse: string, targetHouse: string, types: string[]): Promise<Array<Pick<Vote, 'vote_id' | 'type'>>> {
    return await this._repository.createQueryBuilder()
      .select('vote.vote_id')
      .addSelect('vote.type')
      .leftJoin(
        'vote.user',
        'user',
        'user.house = :sourceHouse',
        { sourceHouse }
      )
      .where('vote.type IN(:...types)', { types })
      .andWhere('vote.choice = :targetHouse', { targetHouse })
      .groupBy('vote.type')
      .getRawMany();
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
