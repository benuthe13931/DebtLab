import type { Dispatch, RefObject, SetStateAction } from "react";
import type { ThemeDefinition } from "../constants/theme";
import type { SavedLoanRecord } from "./loans";

/** Shared boundary contract for simulator state, projections, and actions. */
export interface LoanSimulatorRuntime {
  [key: string]: unknown;
  activePage: "overview" | "simulator" | "paycheck" | "budget" | "profile";
  activeLoanTab: "details" | "transactions" | "history" | "whatif";
  activeView: "assumed" | "history" | "whatif";
  currentLoanId: string | null;
  currentTheme: ThemeDefinition;
  deleteAccountConfirmOpen: boolean;
  deleteCurrentUserProfile?: () => void | Promise<void>;
  deleteLoan?: (id: string) => void | Promise<void>;
  displayName: string;
  firstName: string;
  headerLoans?: unknown[];
  loanName: string;
  loanSidebarCollapsed: boolean;
  profileInitial: string;
  savedLoans: SavedLoanRecord[];
  saveStatus: string;
  setActivePage: Dispatch<SetStateAction<LoanSimulatorRuntime["activePage"]>>;
  setDeleteAccountConfirmOpen: Dispatch<SetStateAction<boolean>>;
  setActiveLoanTab: Dispatch<SetStateAction<LoanSimulatorRuntime["activeLoanTab"]>>;
  setActiveView: Dispatch<SetStateAction<LoanSimulatorRuntime["activeView"]>>;
  setLoanSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  startNewLoan?: (type?: "loan" | "credit-card") => void;
  loadSavedLoan?: (id: string) => void;
  profileMenuRef: RefObject<HTMLDivElement | null>;
}
