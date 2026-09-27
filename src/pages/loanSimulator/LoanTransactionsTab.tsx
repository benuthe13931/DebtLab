import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";








import { CreditCardActivityEditor } from "../../components/loans/CreditCardActivityEditor";












































export function LoanTransactionsTab({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { creditCardTransactions, setCreditCardTransactions, currentTheme } = runtime;
  return (
    <>
      <CreditCardActivityEditor theme={currentTheme} transactions={creditCardTransactions} onChange={setCreditCardTransactions} />
    </>);

}

