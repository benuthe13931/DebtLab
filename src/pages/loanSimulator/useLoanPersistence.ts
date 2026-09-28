import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";
import type { DueDayChange, FutureRecurringChange, LoanSnapshot, PausePeriod, PaymentEvent, SerializedDueDayChange, SerializedFutureRecurringChange, SerializedPausePeriod, SerializedPaymentEvent } from "../../types/loans";
import type { ThemeId } from "../../constants/theme";
import { useEffect } from "react";














import { formatMonth, parseDate, toDateInputValue } from "../../calculations/loans/dateUtils";


import {
  cloudStorageEnabled,
  cloudStorageStatus,
  createCloudProfile,
  deleteCloudProfileData,
  getCloudSessionProfile,
  loadCloudLoans,
  loginCloudProfile,
  logoutCloudProfile,
  sendCloudPasswordResetEmail,
  saveCloudLoans,
  saveCloudProfile } from
"../../lib/cloudStorage";
import type {




  SavedLoanRecord } from








"../../types/loans";
import { parseCurrency } from "../../utils/currency";
import { parseMonthInput } from "../../utils/date";


import { createBlankLoanSnapshot } from "../../constants/loanDefaults";
import type { UserProfile } from "../../types/profile";
import { normalizeProfile } from "../../utils/profile";

const USER_PROFILES_STORAGE_KEY = "loan-sim:user-profiles";
const CURRENT_USER_STORAGE_KEY = "loan-sim:current-user";

type PersistenceContext = Omit<LoanSimulatorRuntime, "assumedResult" | "amortizationProjection" | "historyResult" | "helperProjection" | "whatIfProjection" | "loanInputsReady" | "historyErrors" | "canShowAssumedSchedule" | "startEditingReplayRow" | "saveEditedPayment" | "cancelEditingPayment" | "deleteHelperRow" | "deleteWhatIfPayment" | "deleteWhatIfRecurringChange" | "deleteWhatIfDueDayChange" | "deleteWhatIfPausePeriod" | "nextPaymentDate" | "minimumOnlyLifetimeInterest" | "assumedInterestSavedAsOfToday" | "helperInterestSavedAsOfToday" | "assumedScenarioLifetimeInterest" | "assumedScenarioLifetimeSaved" | "assumedScenarioRemainingInterest" | "assumedScenarioRemainingSaved" | "helperScenarioLifetimeInterest" | "helperScenarioLifetimeSaved" | "helperScenarioRemainingInterest" | "helperScenarioRemainingSaved" | "whatIfProjectedExtrasSavedRemaining" | "whatIfScenarioRemainingInterest" | "whatIfScenarioLifetimeInterest" | "whatIfScenarioSaved" | "activePayoffPercent" | "activeProjectedPayoffDate" | "activeDailyInterestCost" | "activePayoffDuration" | "activeTimeSavedLabel" | "softDangerMessage" | "whatIfDeltaInterest" | "whatIfBaselinePayoffDate" | "whatIfTimeChangeLabel" | "assumedLifetimeSavedTone" | "helperLifetimeSavedTone" | "whatIfLifetimeSavedTone" | "assumedRemainingInterestNotes" | "assumedRemainingSavedNotes" | "assumedLifetimeSavedNotes" | "helperRemainingInterestNotes" | "helperRemainingSavedNotes" | "helperLifetimeSavedNotes" | "whatIfRemainingInterestNotes" | "whatIfAdditionalSavedNotes" | "whatIfLifetimeSavedNotes" | "footnote2Text" | "negativeAmortizationWarning" | "applyLoanSnapshot" | "buildLoanSnapshot" | "serializePaymentEvent" | "deserializePaymentEvent" | "serializeRecurringChange" | "deserializeRecurringChange" | "serializePausePeriod" | "deserializePausePeriod" | "serializeDueDayChange" | "deserializeDueDayChange">;

export function useLoanPersistence(context: PersistenceContext) {
  const { userProfiles, setUserProfiles, currentUserId, setCurrentUserId, authMode, setAuthMode, authName, setAuthName, authDisplayName, setAuthDisplayName, authPassword, setAuthPassword, setAuthError, setActivePage, setActiveLoanTab, setDeleteAccountConfirmOpen, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, setProfileStatus, setPasswordResetCodeInput, setPasswordResetNewPassword, setPasswordResetConfirmPassword, savedLoans, setSavedLoans, currentLoanId, setCurrentLoanId, setSaveStatus, loanName, setLoanName, accountType, setAccountType, promoType, setPromoType, promoEndDate, setPromoEndDate, cardMinimumMode, setCardMinimumMode, cardMinimumPercent, setCardMinimumPercent, cardMinimumFloor, setCardMinimumFloor, postPromoMinimumMode, setPostPromoMinimumMode, postPromoMinimumPercent, setPostPromoMinimumPercent, postPromoMinimumFloor, setPostPromoMinimumFloor, postPromoFixedMinimum, setPostPromoFixedMinimum, cardStatementDate, setCardStatementDate, creditCardTransactions, setCreditCardTransactions, startingPrincipal, setStartingPrincipal, startingPrincipalDate, setStartingPrincipalDate, firstPaymentDate, setFirstPaymentDate, minimumPayment, setMinimumPayment, additionalMonthlyPayment, setAdditionalMonthlyPayment, aprPercent, setAprPercent, dueDay, setDueDay, targetDate, setTargetDate, moveWeekend, setMoveWeekend, roundDailyInterest, setRoundDailyInterest, dayCountBasis, activeView, setActiveView, setDayCountBasis, showAmortization, setShowAmortization, showHelperAmortization, setShowHelperAmortization, oneOffPayments, setOneOffPayments, newOneOffDate, setNewOneOffDate, newOneOffAmount, setNewOneOffAmount, newOneOffLabel, setNewOneOffLabel, helperPausePeriods, setHelperPausePeriods, helperPauseFromMonth, setHelperPauseFromMonth, helperPauseToMonth, setHelperPauseToMonth, helperPauseMode, setHelperPauseMode, helperBulkMode, setHelperBulkMode, helperAdjustmentFromMonth, setHelperAdjustmentFromMonth, helperAdjustmentToMonth, setHelperAdjustmentToMonth, helperAdjustmentAmount, setHelperAdjustmentAmount, helperRecurringChanges, setHelperRecurringChanges, helperDueDayChanges, setHelperDueDayChanges, helperAdjustmentDueDay, setHelperAdjustmentDueDay, deletedHelperRowIds, setDeletedHelperRowIds, helperActionError, setHelperActionError, helperPaymentAmountOverrides, setHelperPaymentAmountOverrides, paymentDateOverrides, setPaymentDateOverrides, paymentLabelOverrides, setPaymentLabelOverrides, editingPaymentId, setEditingPaymentId, editingPaymentDate, setEditingPaymentDate, editingPaymentAmount, setEditingPaymentAmount, editingPaymentLabel, setEditingPaymentLabel, whatIfPayments, setWhatIfPayments, whatIfRecurringChanges, setWhatIfRecurringChanges, whatIfPausePeriods, setWhatIfPausePeriods, whatIfEntryMode, setWhatIfEntryMode, newWhatIfDate, setNewWhatIfDate, newWhatIfAmount, setNewWhatIfAmount, newWhatIfLabel, setNewWhatIfLabel, whatIfAdjustmentDate, setWhatIfAdjustmentDate, whatIfAdjustmentEndDate, setWhatIfAdjustmentEndDate, whatIfAdjustmentAmount, setWhatIfAdjustmentAmount, whatIfAdjustmentDueDay, setWhatIfAdjustmentDueDay, whatIfDueDayChanges, setWhatIfDueDayChanges, whatIfPauseFromMonth, setWhatIfPauseFromMonth, whatIfPauseToMonth, setWhatIfPauseToMonth, whatIfPauseMode, setWhatIfPauseMode, whatIfActionError, setWhatIfActionError, showHistoricalDetails, setShowHistoricalDetails, showFutureDetails, setShowFutureDetails, showLifetimeDetails, setShowLifetimeDetails, showComparisonDetails, setShowComparisonDetails, todayDate, todayValue, getSavedLoansStorageKey, currentUser } = context;
  const serializePaymentEvent = (payment: PaymentEvent): SerializedPaymentEvent => ({
    ...payment,
    date: toDateInputValue(payment.date)
  });

  const deserializePaymentEvent = (payment: SerializedPaymentEvent): PaymentEvent => ({
    ...payment,
    date: parseDate(payment.date) ?? todayDate
  });

  const serializeRecurringChange = (change: FutureRecurringChange): SerializedFutureRecurringChange => ({
    ...change,
    effectiveDate: toDateInputValue(change.effectiveDate),
    endDate: change.endDate ? toDateInputValue(change.endDate) : undefined
  });

  const deserializeRecurringChange = (change: SerializedFutureRecurringChange): FutureRecurringChange => ({
    ...change,
    effectiveDate: parseDate(change.effectiveDate) ?? todayDate,
    endDate: change.endDate ? parseDate(change.endDate) ?? undefined : undefined
  });

  const serializePausePeriod = (pausePeriod: PausePeriod): SerializedPausePeriod => ({
    ...pausePeriod,
    endMonth: formatMonth(pausePeriod.endMonth),
    startMonth: formatMonth(pausePeriod.startMonth)
  });

  const deserializePausePeriod = (pausePeriod: SerializedPausePeriod): PausePeriod => ({
    ...pausePeriod,
    endMonth: parseMonthInput(pausePeriod.endMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1),
    startMonth: parseMonthInput(pausePeriod.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  });

  const serializeDueDayChange = (change: DueDayChange): SerializedDueDayChange => ({
    ...change,
    endMonth: change.endMonth ? formatMonth(change.endMonth) : undefined,
    startMonth: formatMonth(change.startMonth)
  });

  const deserializeDueDayChange = (change: SerializedDueDayChange): DueDayChange => ({
    ...change,
    endMonth: change.endMonth ? parseMonthInput(change.endMonth) ?? undefined : undefined,
    startMonth: parseMonthInput(change.startMonth) ?? new Date(todayDate.getFullYear(), todayDate.getMonth(), 1)
  });

  const applyLoanSnapshot = (snapshot: LoanSnapshot) => {
    setAccountType(snapshot.accountType ?? "loan");
    setPromoType(snapshot.promoType ?? "none");
    setPromoEndDate(snapshot.promoEndDate ?? "");
    setCardMinimumMode(snapshot.cardMinimumMode ?? "percent");
    setCardMinimumPercent(snapshot.cardMinimumPercent ?? "2");
    setCardMinimumFloor(snapshot.cardMinimumFloor ?? "25");
    setPostPromoMinimumMode(snapshot.postPromoMinimumMode ?? "percent");
    setPostPromoMinimumPercent(snapshot.postPromoMinimumPercent ?? "2");
    setPostPromoMinimumFloor(snapshot.postPromoMinimumFloor ?? "25");
    setPostPromoFixedMinimum(snapshot.postPromoFixedMinimum ?? "");
    setCardStatementDate(snapshot.cardStatementDate ?? "");
    setCreditCardTransactions((snapshot.creditCardTransactions ?? []).map(deserializePaymentEvent));
    setLoanName(snapshot.loanName);
    setStartingPrincipal(snapshot.startingPrincipal);
    setStartingPrincipalDate(snapshot.startingPrincipalDate);
    setFirstPaymentDate(snapshot.firstPaymentDate);
    setMinimumPayment(snapshot.minimumPayment);
    setAdditionalMonthlyPayment(snapshot.additionalMonthlyPayment);
    setAprPercent(snapshot.aprPercent);
    setDueDay(snapshot.dueDay);
    setTargetDate(snapshot.targetDate);
    setMoveWeekend(snapshot.moveWeekend);
    setRoundDailyInterest(snapshot.roundDailyInterest);
    setDayCountBasis(snapshot.dayCountBasis);
    setActiveView(snapshot.activeView);
    setShowAmortization(snapshot.showAmortization);
    setShowHelperAmortization(snapshot.showHelperAmortization);
    setOneOffPayments(snapshot.oneOffPayments.map(deserializePaymentEvent));
    setNewOneOffDate(snapshot.newOneOffDate);
    setNewOneOffAmount(snapshot.newOneOffAmount);
    setNewOneOffLabel(snapshot.newOneOffLabel);
    setHelperPausePeriods(snapshot.helperPausePeriods.map(deserializePausePeriod));
    setHelperPauseFromMonth(snapshot.helperPauseFromMonth);
    setHelperPauseToMonth(snapshot.helperPauseToMonth);
    setHelperPauseMode(snapshot.helperPauseMode);
    setHelperBulkMode(snapshot.helperBulkMode);
    setHelperAdjustmentFromMonth(snapshot.helperAdjustmentFromMonth);
    setHelperAdjustmentToMonth(snapshot.helperAdjustmentToMonth);
    setHelperAdjustmentAmount(snapshot.helperAdjustmentAmount);
    setHelperRecurringChanges(snapshot.helperRecurringChanges.map(deserializeRecurringChange));
    setHelperDueDayChanges(snapshot.helperDueDayChanges.map(deserializeDueDayChange));
    setHelperAdjustmentDueDay(snapshot.helperAdjustmentDueDay);
    setDeletedHelperRowIds(snapshot.deletedHelperRowIds);
    setHelperActionError(snapshot.helperActionError);
    setHelperPaymentAmountOverrides(snapshot.helperPaymentAmountOverrides);
    setPaymentDateOverrides(snapshot.paymentDateOverrides);
    setPaymentLabelOverrides(snapshot.paymentLabelOverrides);
    setEditingPaymentId(snapshot.editingPaymentId);
    setEditingPaymentDate(snapshot.editingPaymentDate);
    setEditingPaymentAmount(snapshot.editingPaymentAmount);
    setEditingPaymentLabel(snapshot.editingPaymentLabel);
    setWhatIfPayments(snapshot.whatIfPayments.map(deserializePaymentEvent));
    setWhatIfRecurringChanges(snapshot.whatIfRecurringChanges.map(deserializeRecurringChange));
    setWhatIfPausePeriods(snapshot.whatIfPausePeriods.map(deserializePausePeriod));
    setWhatIfEntryMode(snapshot.whatIfEntryMode);
    setNewWhatIfDate(snapshot.newWhatIfDate);
    setNewWhatIfAmount(snapshot.newWhatIfAmount);
    setNewWhatIfLabel(snapshot.newWhatIfLabel);
    setWhatIfAdjustmentDate(snapshot.whatIfAdjustmentDate);
    setWhatIfAdjustmentEndDate(snapshot.whatIfAdjustmentEndDate);
    setWhatIfAdjustmentAmount(snapshot.whatIfAdjustmentAmount);
    setWhatIfAdjustmentDueDay(snapshot.whatIfAdjustmentDueDay);
    setWhatIfDueDayChanges(snapshot.whatIfDueDayChanges.map(deserializeDueDayChange));
    setWhatIfPauseFromMonth(snapshot.whatIfPauseFromMonth);
    setWhatIfPauseToMonth(snapshot.whatIfPauseToMonth);
    setWhatIfPauseMode(snapshot.whatIfPauseMode);
    setWhatIfActionError(snapshot.whatIfActionError);
    setShowHistoricalDetails(snapshot.showHistoricalDetails);
    setShowFutureDetails(snapshot.showFutureDetails);
    setShowLifetimeDetails(snapshot.showLifetimeDetails);
    setShowComparisonDetails(snapshot.showComparisonDetails);
  };

  const buildLoanSnapshot = (): LoanSnapshot => ({
    accountType,
    cardMinimumMode,
    cardMinimumPercent,
    cardMinimumFloor,
    postPromoMinimumMode,
    postPromoMinimumPercent,
    postPromoMinimumFloor,
    postPromoFixedMinimum,
    cardStatementDate,
    activeView,
    additionalMonthlyPayment,
    aprPercent,
    dayCountBasis,
    deletedHelperRowIds,
    dueDay,
    editingPaymentAmount,
    editingPaymentDate,
    editingPaymentId,
    editingPaymentLabel,
    firstPaymentDate,
    helperActionError,
    helperAdjustmentAmount,
    helperAdjustmentDueDay,
    helperAdjustmentFromMonth,
    helperAdjustmentToMonth,
    helperBulkMode,
    helperDueDayChanges: helperDueDayChanges.map(serializeDueDayChange),
    helperPauseFromMonth,
    helperPauseMode,
    helperPausePeriods: helperPausePeriods.map(serializePausePeriod),
    helperPauseToMonth,
    helperPaymentAmountOverrides,
    helperRecurringChanges: helperRecurringChanges.map(serializeRecurringChange),
    loanName,
    minimumPayment,
    moveWeekend,
    newOneOffAmount,
    newOneOffDate,
    newOneOffLabel,
    newWhatIfAmount,
    newWhatIfDate,
    newWhatIfLabel,
    oneOffPayments: oneOffPayments.map(serializePaymentEvent),
    creditCardTransactions: creditCardTransactions.map(serializePaymentEvent),
    promoType,
    promoEndDate,
    paymentDateOverrides,
    paymentLabelOverrides,
    roundDailyInterest,
    showAmortization,
    showComparisonDetails,
    showFutureDetails,
    showHelperAmortization,
    showHistoricalDetails,
    showLifetimeDetails,
    startingPrincipal,
    startingPrincipalDate,
    targetDate,
    whatIfActionError,
    whatIfAdjustmentAmount,
    whatIfAdjustmentDate,
    whatIfAdjustmentDueDay,
    whatIfAdjustmentEndDate,
    whatIfDueDayChanges: whatIfDueDayChanges.map(serializeDueDayChange),
    whatIfEntryMode,
    whatIfPauseFromMonth,
    whatIfPauseMode,
    whatIfPausePeriods: whatIfPausePeriods.map(serializePausePeriod),
    whatIfPauseToMonth,
    whatIfPayments: whatIfPayments.map(serializePaymentEvent),
    whatIfRecurringChanges: whatIfRecurringChanges.map(serializeRecurringChange)
  });

  const loadLoansForUser = async (userId: string) => {
    if (cloudStorageEnabled) {
      try {
        const parsed = await loadCloudLoans<SavedLoanRecord>(userId);
        if (parsed.length === 0) {
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
          return;
        }

        setSavedLoans(parsed);
        setCurrentLoanId(parsed[0].id);
        applyLoanSnapshot(parsed[0].data);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not load cloud loans.");
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
      }
      return;
    }

    try {
      const raw = localStorage.getItem(getSavedLoansStorageKey(userId));
      if (!raw) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
        return;
      }
      const parsed = JSON.parse(raw) as SavedLoanRecord[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setSavedLoans([]);
        setCurrentLoanId(null);
        applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
        return;
      }
      setSavedLoans(parsed);
      setCurrentLoanId(parsed[0].id);
      applyLoanSnapshot(parsed[0].data);
    } catch {
      setSavedLoans([]);
      setCurrentLoanId(null);
      applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
    }
  };

  useEffect(() => {
    let isMounted = true;
    console.info(
      cloudStorageEnabled ?
      "LoanSim cloud storage enabled: Supabase env vars are present." :
      "LoanSim local storage mode: VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing.",
      cloudStorageStatus
    );

    if (cloudStorageEnabled) {
      void (async () => {
        try {
          const profile = await getCloudSessionProfile();
          if (!isMounted) return;

          if (!profile) {
            setSaveStatus("Supabase connected. Sign in or create an account to load cloud loans.");
            setUserProfiles([]);
            setCurrentUserId(null);
            setSavedLoans([]);
            setCurrentLoanId(null);
            applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
            return;
          }

          const normalized = normalizeProfile(profile as UserProfile);
          setUserProfiles([normalized]);
          setCurrentUserId(normalized.id);
          await loadLoansForUser(normalized.id);
        } catch {
          if (!isMounted) return;
          setUserProfiles([]);
          setCurrentUserId(null);
          setSavedLoans([]);
          setCurrentLoanId(null);
          applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
        }
      })();

      return () => {
        isMounted = false;
      };
    }

    setUserProfiles([]);
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
    setSaveStatus("Supabase authentication is required. Configure Supabase to continue.");
  }, []);

  const persistSavedLoans = (nextLoans: SavedLoanRecord[], userId = currentUserId) => {
    setSavedLoans(nextLoans);
    if (!userId) return;
    if (cloudStorageEnabled) {
      void saveCloudLoans(userId, nextLoans).catch((error) => {
        setSaveStatus(error instanceof Error ? error.message : "Could not sync cloud loans.");
      });
      return;
    }
    localStorage.setItem(getSavedLoansStorageKey(userId), JSON.stringify(nextLoans));
  };

  const persistUserProfiles = (nextProfiles: UserProfile[]) => {
    setUserProfiles(nextProfiles);
    if (cloudStorageEnabled) {
      const currentProfile = currentUserId ?
      nextProfiles.find((profile) => profile.id === currentUserId) :
      nextProfiles[0];
      if (currentProfile) {
        void saveCloudProfile(currentProfile).catch((error) => {
          setProfileStatus(error instanceof Error ? error.message : "Could not sync cloud profile.");
        });
      }
      return;
    }
    localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(nextProfiles));
  };

  const updateCurrentUserProfile = (updater: (profile: UserProfile) => UserProfile) => {
    if (!currentUserId) return;
    const nextProfiles = userProfiles.map((profile) =>
    profile.id === currentUserId ? updater(profile) : profile
    );
    persistUserProfiles(nextProfiles);
  };

  const loginUser = (userId: string, userName: string) => {
    setCurrentUserId(userId);
    if (!cloudStorageEnabled) {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
    }
    setActivePage("simulator");
    setActiveView("assumed");
    setSaveStatus(`Logged in as ${userName}`);
    setAuthError("");
    setAuthName("");
    setAuthDisplayName("");
    setAuthPassword("");
    setProfileStatus("");
    setPasswordResetCodeInput("");
    setPasswordResetNewPassword("");
    setPasswordResetConfirmPassword("");
    void loadLoansForUser(userId);
  };

  const handleAuthSubmit = async () => {
    const trimmedName = authName.trim();
    const trimmedDisplayName = authDisplayName.trim();
    if (!trimmedName || !authPassword) {
      setAuthError(`Enter your email and password.`);
      return;
    }

    if (cloudStorageEnabled) {
      try {
        if (authMode === "create" && !trimmedDisplayName) {
          setAuthError("Enter your name.");
          return;
        }
        const profile = authMode === "create" ?
        await createCloudProfile(trimmedName, authPassword, trimmedDisplayName) :
        await loginCloudProfile(trimmedName, authPassword);
        if (profile.needsEmailConfirmation) {
          setAuthError("Check your email to confirm the account, then log in.");
          setAuthPassword("");
          setAuthMode("login");
          return;
        }
        const normalized = normalizeProfile(profile as UserProfile);
        setUserProfiles([normalized]);
        applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
        setSavedLoans([]);
        setCurrentLoanId(null);
        loginUser(normalized.id, normalized.name);
      } catch (error) {
        setAuthError(error instanceof Error ? error.message : "Authentication failed.");
      }
      return;
    }

    setAuthError("Supabase authentication is required. Configure Supabase to continue.");
  };

  const logoutUser = () => {
    if (cloudStorageEnabled) {
      void logoutCloudProfile().catch(() => undefined);
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setActivePage("simulator");
    setSaveStatus("");
    setAuthPassword("");
    setAuthError("");
    applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
  };

  const deleteCurrentUserProfile = async () => {
    if (!currentUserId) return;
    const selectedProfile = userProfiles.find((profile) => profile.id === currentUserId);
    if (!selectedProfile) return;
    if (cloudStorageEnabled) {
      try {
        await deleteCloudProfileData();
        await logoutCloudProfile().catch(() => undefined);
      } catch (error) {
        setSaveStatus(error instanceof Error ? error.message : "Could not delete cloud profile data.");
        setDeleteAccountConfirmOpen(false);
        return;
      }
    } else {
      localStorage.removeItem(getSavedLoansStorageKey(currentUserId));
    }
    const nextProfiles = userProfiles.filter((profile) => profile.id !== currentUserId);
    persistUserProfiles(nextProfiles);

    if (!cloudStorageEnabled) {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
    setCurrentUserId(null);
    setSavedLoans([]);
    setCurrentLoanId(null);
    setSaveStatus(`Deleted ${selectedProfile.name}`);
    setAuthMode("login");
    setAuthName("");
    setAuthPassword("");
    setAuthError("");
    setDeleteAccountConfirmOpen(false);
    applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
  };

  useEffect(() => {
    if (!currentUser) {
      setProfileDraftName("");
      setProfileDraftEmail("");
      setProfileStatus("");
      setPasswordResetCodeInput("");
      setPasswordResetNewPassword("");
      setPasswordResetConfirmPassword("");
      return;
    }
    setProfileDraftName(currentUser.displayName || currentUser.name);
    setProfileDraftEmail(currentUser.email);
  }, [currentUser?.id, currentUser?.displayName, currentUser?.email, currentUser?.name]);

  const saveProfileDetails = () => {
    if (!currentUser) return;
    const trimmedDisplayName = profileDraftName.trim();
    const trimmedEmail = profileDraftEmail.trim();
    if (!trimmedDisplayName) {
      setProfileStatus("Enter a display name.");
      return;
    }
    updateCurrentUserProfile((profile) => ({
      ...profile,
      displayName: trimmedDisplayName,
      email: trimmedEmail
    }));
    setProfileStatus("Profile updated.");
  };

  const applyThemeToProfile = (themeId: ThemeId) => {
    updateCurrentUserProfile((profile) => ({
      ...profile,
      themeId
    }));
  };

  const sendPasswordResetEmail = () => {
    if (!currentUser) return;
    const email = profileDraftEmail.trim() || currentUser.email.trim();
    if (!email) {
      setProfileStatus("Add an email address before requesting a password reset.");
      return;
    }
    void sendCloudPasswordResetEmail(email).
    then(() => {
      setProfileDraftEmail(email);
      setProfileStatus(`Password reset email sent to ${email}. Follow the Supabase email link to finish.`);
    }).
    catch((error) => {
      setProfileStatus(error instanceof Error ? error.message : "Could not send password reset email.");
    });
  };

  const applyPasswordReset = () => {
    setProfileStatus("Use the Supabase password reset email link to change your password.");
  };
  const saveCurrentLoan = () => {
    if (!currentUserId) {
      window.alert("Create or select a profile before saving a loan.");
      return;
    }
    const snapshot = buildLoanSnapshot();
    const trimmedName = loanName.trim() || "Untitled loan";
    const loanId = currentLoanId ?? `loan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nextRecord: SavedLoanRecord = {
      data: {
        ...snapshot,
        loanName: trimmedName,
        overviewBalance: parseCurrency(startingPrincipal),
        overviewOriginalBalance: parseCurrency(startingPrincipal)
      },
      id: loanId,
      name: trimmedName
    };

    const nextLoans = currentLoanId ?
    savedLoans.map((loan) => loan.id === currentLoanId ? nextRecord : loan) :
    [...savedLoans, nextRecord];

    setLoanName(trimmedName);
    setCurrentLoanId(loanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Saved ${trimmedName}`);
  };

  const startNewLoan = (type: "loan" | "credit-card" = "loan") => {
    setCurrentLoanId(null);
    setSaveStatus("");
    applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
    setAccountType(type);
    setPromoType("none");
    setPromoEndDate("");
    setLoanName(type === "credit-card" ? "New credit card" : "");
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const loadSavedLoan = (loanId: string) => {
    const selectedLoan = savedLoans.find((loan) => loan.id === loanId);
    if (!selectedLoan) return;
    setCurrentLoanId(selectedLoan.id);
    setSaveStatus("");
    applyLoanSnapshot(selectedLoan.data);
    setActiveLoanTab("details");
    setActiveView("assumed");
  };

  const deleteLoan = (loanId: string) => {
    const selectedLoan = savedLoans.find((loan) => loan.id === loanId);
    if (!selectedLoan) return;
    const confirmed = window.confirm(`Delete saved loan "${selectedLoan.name}"?`);
    if (!confirmed) return;

    const nextLoans = savedLoans.filter((loan) => loan.id !== loanId);
    persistSavedLoans(nextLoans);
    setSaveStatus(`Deleted ${selectedLoan.name}`);

    if (loanId !== currentLoanId) return;
    if (nextLoans.length > 0) {
      setCurrentLoanId(nextLoans[0].id);
      applyLoanSnapshot(nextLoans[0].data);
      return;
    }

    setCurrentLoanId(null);
    applyLoanSnapshot(createBlankLoanSnapshot(todayValue));
  };

  return { serializePaymentEvent, deserializePaymentEvent, serializeRecurringChange, deserializeRecurringChange, serializePausePeriod, deserializePausePeriod, serializeDueDayChange, deserializeDueDayChange, applyLoanSnapshot, buildLoanSnapshot, loadLoansForUser, persistSavedLoans, persistUserProfiles, updateCurrentUserProfile, loginUser, handleAuthSubmit, logoutUser, deleteCurrentUserProfile, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, applyPasswordReset, saveCurrentLoan, startNewLoan, loadSavedLoan, deleteLoan };
}



