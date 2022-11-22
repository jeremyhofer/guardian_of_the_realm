import { DeleteResult, LessThanOrEqual, Repository } from 'typeorm';
import { PlayerData } from '../entity/PlayerData';
import { Loan } from '../entity/Loan';

export class LoanDAO {
  constructor(private readonly _repository: Repository<Loan>) {}

  async getLoansForUser(user: PlayerData): Promise<Loan[]> {
    return await this._repository.findBy({
      user
    });
  }

  async getDueLoans(time: number): Promise<Loan[]> {
    return await this._repository.find({
      relations: {
        user: true
      },
      where: {
        time_due: LessThanOrEqual(time)
      }
    });
  }

  async saveLoan(loan: Loan): Promise<Loan> {
    return await this._repository.save(loan);
  }

  async removeLoan(loanId: number): Promise<DeleteResult> {
    return await this._repository.delete({ loan_id: loanId });
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
