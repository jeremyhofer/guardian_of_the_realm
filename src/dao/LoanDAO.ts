import { DeleteResult, LessThanOrEqual, Repository } from 'typeorm';
import { Loan } from '../entity/Loan';

export class LoanDAO {
  constructor(private readonly _repository: Repository<Loan>) {}

  async getDueLoans(time: number): Promise<Loan[]> {
    return await this._repository.find({
      relations: {
        user: true,
      },
      where: {
        time_due: LessThanOrEqual(time),
      },
    });
  }

  createLoan(pLoan: Partial<Loan>): Loan {
    return this._repository.create(pLoan);
  }

  async saveLoan(loan: Loan): Promise<Loan> {
    return await this._repository.save(loan);
  }

  async removeLoan(loan: Loan): Promise<DeleteResult> {
    return await this._repository.delete(loan.loan_id);
  }

  async deleteAll(): Promise<void> {
    return await this._repository.clear();
  }
}
