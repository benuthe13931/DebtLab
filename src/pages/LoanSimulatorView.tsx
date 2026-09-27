// @ts-nocheck
import{PaycheckPage}from"./PaycheckPage";import{DebtOverview}from"./DebtOverviewPage";import{BudgetPage}from"./BudgetPage";import{DateField,DatePickerInput,MonthYearField}from"../components/ui/date-fields";import{FormSection,SummaryGroupLabel,SummaryValue}from"../components/ui/summary";import{LoanSidebar}from"../components/loans/LoanSidebar";import{CreditCardActivityEditor}from"../components/loans/CreditCardActivityEditor";import{LabelWithNotes,formatPrincipalShare,getEventTypeCode,getEventTypeTitle,getTableRowStyle}from"../components/loans/schedulePresentation";import{CurrencyField,CurrencyInput}from"../components/ui/CurrencyField";import{Field}from"../components/ui/Field";import{formatMonth,toDateInputValue}from"../calculations/loans/dateUtils";import{cloudStorageEnabled}from"../lib/cloudStorage";import{parseCurrency}from"../utils/currency";import{monthValue}from"../utils/date";import{formatCurrency,formatMonthYear,formatPauseRange,formatPercent,getDifferenceLabel}from"../utils/formatting";import{THEME_DEFINITIONS}from"../constants/theme";function pausePeriodsOverlap(left,right){return monthValue(left.startMonth)<=monthValue(right.endMonth)&&monthValue(right.startMonth)<=monthValue(left.endMonth)}const SAVED_LOANS_STORAGE_KEY="loan-sim:saved-loans",USER_PROFILES_STORAGE_KEY="loan-sim:user-profiles",CURRENT_USER_STORAGE_KEY="loan-sim:current-user",asThemeId=themeId=>themeId==="forest"||themeId==="sunset"||themeId==="midnight"||themeId==="rose"||themeId==="slate"?themeId:"sky",normalizeProfile=profile=>({...profile,themeId:asThemeId(profile.themeId)});export function LoanSimulatorView({runtime}){const{userProfiles,setUserProfiles,currentUserId,setCurrentUserId,authMode,setAuthMode,authName,setAuthName,authDisplayName,setAuthDisplayName,authPassword,setAuthPassword,authError,setAuthError,activePage,setActivePage,activeLoanTab,setActiveLoanTab,loanSidebarCollapsed,setLoanSidebarCollapsed,profileMenuOpen,setProfileMenuOpen,deleteAccountConfirmOpen,setDeleteAccountConfirmOpen,profileMenuRef,profileDraftName,setProfileDraftName,profileDraftEmail,setProfileDraftEmail,profileStatus,setProfileStatus,passwordResetCodeInput,setPasswordResetCodeInput,passwordResetNewPassword,setPasswordResetNewPassword,passwordResetConfirmPassword,setPasswordResetConfirmPassword,savedLoans,setSavedLoans,currentLoanId,setCurrentLoanId,saveStatus,setSaveStatus,loanName,setLoanName,accountType,setAccountType,promoType,setPromoType,promoEndDate,setPromoEndDate,cardMinimumMode,setCardMinimumMode,cardMinimumPercent,setCardMinimumPercent,cardMinimumFloor,setCardMinimumFloor,postPromoMinimumMode,setPostPromoMinimumMode,postPromoMinimumPercent,setPostPromoMinimumPercent,postPromoMinimumFloor,setPostPromoMinimumFloor,postPromoFixedMinimum,setPostPromoFixedMinimum,cardStatementDate,setCardStatementDate,creditCardTransactions,setCreditCardTransactions,startingPrincipal,setStartingPrincipal,startingPrincipalDate,setStartingPrincipalDate,firstPaymentDate,setFirstPaymentDate,minimumPayment,setMinimumPayment,additionalMonthlyPayment,setAdditionalMonthlyPayment,aprPercent,setAprPercent,dueDay,setDueDay,targetDate,setTargetDate,moveWeekend,setMoveWeekend,roundDailyInterest,setRoundDailyInterest,dayCountBasis,setDayCountBasis,activeView,setActiveView,showAmortization,setShowAmortization,showHelperAmortization,setShowHelperAmortization,oneOffPayments,setOneOffPayments,newOneOffDate,setNewOneOffDate,newOneOffAmount,setNewOneOffAmount,newOneOffLabel,setNewOneOffLabel,helperPausePeriods,setHelperPausePeriods,helperPauseFromMonth,setHelperPauseFromMonth,helperPauseToMonth,setHelperPauseToMonth,helperPauseMode,setHelperPauseMode,helperBulkMode,setHelperBulkMode,helperAdjustmentFromMonth,setHelperAdjustmentFromMonth,helperAdjustmentToMonth,setHelperAdjustmentToMonth,helperAdjustmentAmount,setHelperAdjustmentAmount,helperRecurringChanges,setHelperRecurringChanges,helperDueDayChanges,setHelperDueDayChanges,helperAdjustmentDueDay,setHelperAdjustmentDueDay,deletedHelperRowIds,setDeletedHelperRowIds,helperActionError,setHelperActionError,helperPaymentAmountOverrides,setHelperPaymentAmountOverrides,paymentDateOverrides,setPaymentDateOverrides,paymentLabelOverrides,setPaymentLabelOverrides,editingPaymentId,setEditingPaymentId,editingPaymentDate,setEditingPaymentDate,editingPaymentAmount,setEditingPaymentAmount,editingPaymentLabel,setEditingPaymentLabel,whatIfPayments,setWhatIfPayments,whatIfRecurringChanges,setWhatIfRecurringChanges,whatIfPausePeriods,setWhatIfPausePeriods,whatIfEntryMode,setWhatIfEntryMode,newWhatIfDate,setNewWhatIfDate,newWhatIfAmount,setNewWhatIfAmount,newWhatIfLabel,setNewWhatIfLabel,whatIfAdjustmentDate,setWhatIfAdjustmentDate,whatIfAdjustmentEndDate,setWhatIfAdjustmentEndDate,whatIfAdjustmentAmount,setWhatIfAdjustmentAmount,whatIfAdjustmentDueDay,setWhatIfAdjustmentDueDay,whatIfDueDayChanges,setWhatIfDueDayChanges,whatIfPauseFromMonth,setWhatIfPauseFromMonth,whatIfPauseToMonth,setWhatIfPauseToMonth,whatIfPauseMode,setWhatIfPauseMode,whatIfActionError,setWhatIfActionError,showHistoricalDetails,setShowHistoricalDetails,showFutureDetails,setShowFutureDetails,showLifetimeDetails,setShowLifetimeDetails,showComparisonDetails,setShowComparisonDetails,cardScheduleStart,cardScheduleFirstPayment,cardScheduleTarget,deferredStartingPrincipal,deferredStartingPrincipalDate,deferredFirstPaymentDate,deferredMinimumPayment,deferredAdditionalMonthlyPayment,deferredAprPercent,deferredDueDay,deferredTargetDate,cardMinimumPayment,cardProjectionNudge,effectiveMinimumPayment,totalMonthlyPayment,buildProjection,todayDate,todayValue,getSavedLoansStorageKey,currentUser,currentTheme,displayName,firstName,profileInitial,serializePaymentEvent,deserializePaymentEvent,serializeRecurringChange,deserializeRecurringChange,serializePausePeriod,deserializePausePeriod,serializeDueDayChange,deserializeDueDayChange,applyLoanSnapshot,buildLoanSnapshot,loadLoansForUser,persistSavedLoans,persistUserProfiles,updateCurrentUserProfile,loginUser,handleAuthSubmit,logoutUser,deleteCurrentUserProfile,saveProfileDetails,applyThemeToProfile,sendPasswordResetEmail,applyPasswordReset,saveCurrentLoan,startNewLoan,loadSavedLoan,deleteLoan,helperVisiblePayments,helperPaymentsThroughTarget,helperPausePeriodsThroughTarget,helperScheduledAdjustments,helperDueDayAdjustments,assumedResult,minimumOnlyToDateProjection,amortizationTargetDate,fullLoanTargetDate,assumedCurrentPlanProjection,amortizationProjection,minimumOnlyFullProjection,assumedFullProjection,historyResult,helperAmortizationTargetDate,helperProjection,helperCurrentPlanProjection,whatIfTargetDate,nextPaymentDate,whatIfAllPayments,whatIfRecurringAdjustments,whatIfDueDayAdjustments,whatIfProjection,loanInputsReady,historyErrors,assumedInterestSaved,minimumOnlyLifetimeInterest,assumedInterestSavedAsOfToday,assumedInterestSavedFromTodayForward,helperInterestSavedAsOfToday,helperInterestSavedOverall,helperInterestSavedFromTodayForward,assumedInterestStillOwedWithAdditional,helperTotalExpectedInterestPaidIncludingAdditional,whatIfTotalExpectedInterestPaidIncludingAdditionalMonthly,whatIfTotalExpectedInterestPaidIncludingAnticipated,whatIfHasProjectedExtras,assumedScenarioLifetimeInterest,assumedScenarioLifetimeSaved,assumedScenarioRemainingInterest,assumedScenarioRemainingSaved,helperScenarioLifetimeInterest,helperScenarioLifetimeSaved,helperScenarioRemainingInterest,helperScenarioRemainingSaved,minimumOnlyRemainingInterest,whatIfBaseRemainingInterest,whatIfBaseLifetimeInterest,whatIfProjectedExtrasSavedRemaining,whatIfScenarioRemainingInterest,whatIfScenarioLifetimeInterest,whatIfScenarioSaved,startingPrincipalAmount,assumedPayoffPercent,historyPayoffPercent,activePayoffPercent,activeProjectedPayoffDate,canShowAssumedSchedule,baselinePayoffDate,activeAsOfDate,projectedScenarioPrincipalForDailyCost,activeInterestStartDate,activeInterestEndDate,activeDailyInterestCost,activePayoffDuration,baselinePayoffDeltaMonths,activeTimeSavedLabel,assumedReferenceRow,historyReferenceRow,whatIfReferenceRow,activeReferenceRow,activePrincipalShare,activeInterestShare,softDangerMessage,whatIfDeltaInterest,whatIfBaselinePayoffDate,whatIfDeltaMonths,whatIfTimeChangeLabel,assumedLifetimeSavedTone,helperLifetimeSavedTone,whatIfLifetimeSavedTone,assumedRemainingInterestNotes,assumedRemainingSavedNotes,assumedLifetimeSavedNotes,helperRemainingInterestNotes,helperRemainingSavedNotes,helperLifetimeSavedNotes,whatIfRemainingInterestNotes,whatIfAdditionalSavedNotes,whatIfLifetimeSavedNotes,footnote2Text,assumedHasNegativeAmortization,historyHasNegativeAmortization,whatIfHasNegativeAmortization,negativeAmortizationWarning,startingPrincipalDateValue,minimumTargetDate,targetDateMinValue,helperMaxMonthValue,whatIfMinimumPaymentDate,whatIfMinDate,whatIfMinDateValue,addHelperPausePeriod,deleteHelperPausePeriod,addHelperBulkAdjustment,deleteHelperRecurringChange,deleteHelperDueDayChange,addOneOffPayment,startEditingReplayRow,saveEditedPayment,cancelEditingPayment,deleteHelperRow,addWhatIfPayment,deleteWhatIfPayment,deleteWhatIfRecurringChange,deleteWhatIfDueDayChange,deleteWhatIfPausePeriod,resetHelper,resetWhatIf,headerLoans,headerProjection,headerOriginalDebt,headerProgress}=runtime;return<div style={{minHeight:"100vh",background:currentTheme.appBackground,padding:"24px 16px 48px",color:currentTheme.text,"--app-accent":currentTheme.accent,"--app-accent-soft":currentTheme.accentSoft,"--app-border":currentTheme.cardBorder,"--app-border-strong":currentTheme.cardBorder,"--app-heading":currentTheme.text,"--app-input-bg":currentTheme.surface,"--app-danger-bg":currentTheme.isDark?"rgba(127, 29, 29, 0.35)":"#fff1f2","--app-danger-border":currentTheme.isDark?"#7f1d1d":"#fecaca","--app-danger-text":currentTheme.isDark?"#fecaca":"#991b1b","--app-negative-bg":currentTheme.isDark?"rgba(157, 23, 77, 0.25)":"#fff1f2","--app-negative-border":currentTheme.isDark?"#9d174d":"#fda4af","--app-negative-text":currentTheme.isDark?"#f9a8d4":"#be123c","--app-positive-bg":currentTheme.isDark?"rgba(21, 128, 61, 0.22)":"#ecfdf5","--app-positive-border":currentTheme.isDark?"#166534":"#86efac","--app-positive-text":currentTheme.isDark?"#86efac":"#15803d","--app-benchmark-bg":currentTheme.isDark?"rgba(180, 83, 9, 0.22)":"#fefce8","--app-benchmark-border":currentTheme.isDark?"#92400e":"#fde68a","--app-benchmark-text":currentTheme.isDark?"#fcd34d":"#a16207","--app-row-negative":currentTheme.isDark?"rgba(146, 64, 14, 0.18)":"#fffbeb","--app-row-paused":currentTheme.isDark?"rgba(194, 65, 12, 0.16)":"#fff7ed","--app-surface":currentTheme.surface,"--app-surface-muted":currentTheme.surfaceMuted,"--app-table-header":currentTheme.surfaceMuted,"--app-table-border":currentTheme.cardBorder,"--app-text":currentTheme.text,"--app-text-muted":currentTheme.textMuted}}>
      <div style={{maxWidth:1760,margin:"0 auto",display:"grid",gap:20,gridTemplateColumns:loanSidebarCollapsed?"44px minmax(0, 1fr)":"260px minmax(0, 1fr)",alignItems:"start"}}>
        <LoanSidebar collapsed={loanSidebarCollapsed}currentLoanId={currentLoanId}loanName={loanName}loans={savedLoans}onAdd={type=>{startNewLoan(type),setActivePage("simulator")}}onCollapse={()=>setLoanSidebarCollapsed(collapsed=>!collapsed)}onDelete={deleteLoan}onOverview={()=>setActivePage("overview")}onSelect={loanId=>{loadSavedLoan(loanId),setActivePage("simulator")}}saveStatus={saveStatus}/>
        <div style={{display:"grid",gap:24,minWidth:0}}>
        <header style={{display:"flex",gap:20,alignItems:"center",justifyContent:"space-between",textAlign:"left"}}>
          <button type="button"onClick={()=>{setActivePage("simulator"),setActiveLoanTab("details"),setActiveView("assumed")}}style={{display:"flex",gap:14,alignItems:"center",border:0,padding:0,background:"transparent",color:currentTheme.text,cursor:"pointer",textAlign:"left"}}>
            <span aria-hidden="true"style={{width:48,height:48,borderRadius:14,background:`linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent})`,boxShadow:currentTheme.cardShadow,flexShrink:0}}/>
            <span>
              <span style={{display:"block",fontSize:34,fontWeight:750,lineHeight:1.1}}>DebtLab</span>
              <span style={{display:"block",marginTop:6,color:currentTheme.textMuted,fontSize:15}}>
                {activePage==="paycheck"?"Estimate pay and annual taxes.":activePage==="budget"?"Track recurring bills and available cash flow.":activePage==="profile"?"Manage your account and preferences.":activePage==="overview"?"Compare payoff strategies across all saved loans.":"Model loan payments and plan your payoff."}
              </span>
            </span>
          </button>
          {headerLoans.length>0?<button type="button"onClick={()=>setActivePage("overview")}style={{marginLeft:"auto",minWidth:320,display:"grid",gridTemplateColumns:"1fr 1fr",gap:"5px 16px",border:`1px solid ${currentTheme.cardBorder}`,borderRadius:14,padding:"10px 14px",background:currentTheme.surface,color:currentTheme.text,textAlign:"left",cursor:"pointer",boxShadow:currentTheme.cardShadow}}><span style={{fontSize:11,color:currentTheme.textMuted}}>Remaining debt</span><span style={{fontSize:11,color:currentTheme.textMuted}}>Estimated payoff</span><strong>{formatCurrency(headerProjection.startingTotal)}</strong><strong>{formatMonthYear(headerProjection.payoffDate)}</strong><span style={{gridColumn:"1 / 3",height:5,borderRadius:999,overflow:"hidden",background:currentTheme.surfaceMuted}}><span style={{display:"block",width:`${headerProgress}%`,height:"100%",background:currentTheme.accent}}/></span></button>:null}
          <div ref={profileMenuRef}style={{position:"relative"}}>
            <button type="button"aria-expanded={profileMenuOpen}onClick={()=>setProfileMenuOpen(open=>!open)}style={{display:"flex",gap:10,alignItems:"center",border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"7px 12px 7px 7px",fontWeight:700,cursor:"pointer",boxShadow:currentTheme.cardShadow}}>
              <span aria-hidden="true"style={{width:34,height:34,display:"grid",placeItems:"center",borderRadius:"50%",background:currentTheme.accent,color:"#fff",fontSize:14}}>{profileInitial}</span>
              <span>Welcome, {firstName}</span>
              <span aria-hidden="true"style={{fontSize:11,color:currentTheme.textMuted}}>{profileMenuOpen?"\xE2\u2013\xB2":"\xE2\u2013\xBC"}</span>
            </button>
            {profileMenuOpen?<div style={{position:"absolute",right:0,top:"calc(100% + 8px)",zIndex:30,width:220,padding:8,display:"grid",gap:4,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:14,background:currentTheme.surface,boxShadow:"0 18px 40px rgba(15, 23, 42, 0.18)"}}>
                {[{label:"View profile",action:()=>setActivePage("profile")},{label:"Pay & tax estimator",action:()=>setActivePage("paycheck")},{label:"Bills & budget",action:()=>setActivePage("budget")},{label:"Log out",action:logoutUser}].map(item=><button key={item.label}type="button"onClick={()=>{setProfileMenuOpen(!1),item.action()}}style={{border:0,borderRadius:9,padding:"10px 12px",background:"transparent",color:currentTheme.text,textAlign:"left",fontWeight:600,cursor:"pointer"}}>{item.label}</button>)}
              </div>:null}
          </div>
        </header>
        {saveStatus.startsWith("Saved")?<div role="status"style={{position:"fixed",right:24,bottom:24,zIndex:60,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:12,padding:"10px 14px",background:currentTheme.surface,color:currentTheme.text,boxShadow:currentTheme.cardShadow,fontWeight:700}}>{saveStatus}</div>:null}
        {activePage==="overview"?<DebtOverview loans={savedLoans}theme={currentTheme}userId={currentUserId}/>:activePage==="profile"?<main style={{display:"grid",gap:24}}>
            <section style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:20,padding:24,boxShadow:currentTheme.cardShadow,display:"grid",gap:24}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:16}}>
                <div style={{display:"grid",gap:8}}>
                <h2 style={{margin:0,fontSize:28}}>Profile</h2>
                <p style={{margin:0,color:currentTheme.textMuted,lineHeight:1.6,maxWidth:760}}>
                  Keep your account details up to date, pick a theme for the simulator, and use a one-time reset code emailed to you when you want to change your password.
                </p>
                </div>
                <button type="button"aria-label="Close profile"onClick={()=>{setActivePage("simulator"),setActiveLoanTab("details"),setActiveView("assumed")}}style={{width:38,height:38,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,background:currentTheme.surface,color:currentTheme.text,fontSize:22,cursor:"pointer"}}>Ãƒâ€”</button>
              </div>

              {profileStatus?<div style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.accentSoft,color:currentTheme.text,borderRadius:14,padding:"12px 14px",fontSize:14}}>
                  {profileStatus}
                </div>:null}

              <div style={{display:"grid",gap:24,gridTemplateColumns:"minmax(320px, 1fr) minmax(320px, 1fr)"}}>
                <div style={{border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,display:"grid",gap:16,alignContent:"start"}}>
                  <div style={{display:"grid",gap:4}}>
                    <h3 style={{margin:0,fontSize:20}}>Account details</h3>
                      <div style={{color:currentTheme.textMuted,fontSize:14}}>
                      Your username stays the same for login. Your profile name is what shows in the app.
                    </div>
                  </div>
                  <div style={{display:"grid",gap:14}}>
                    <div style={{display:"grid",gap:6}}>
                      <span style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Username</span>
                      <div style={{border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,padding:"10px 12px",fontSize:15,background:currentTheme.surfaceMuted,color:currentTheme.textMuted}}>
                        {currentUser?.name}
                      </div>
                    </div>
                    <Field id="profile-display-name"label="Your name"value={profileDraftName}onChange={setProfileDraftName}/>
                    <Field id="profile-email"label="Email"value={profileDraftEmail}onChange={setProfileDraftEmail}/>
                    <button type="button"onClick={saveProfileDetails}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer",justifySelf:"start"}}>
                      Save profile
                    </button>
                    <div style={{marginTop:8,paddingTop:16,borderTop:`1px solid ${currentTheme.cardBorder}`,display:"grid",gap:8}}>
                      <div style={{fontSize:14,fontWeight:700,color:currentTheme.text}}>Delete account</div>
                      <div style={{fontSize:12,lineHeight:1.5,color:currentTheme.textMuted}}>Permanently remove your profile and all saved loan data.</div>
                      <button type="button"onClick={()=>setDeleteAccountConfirmOpen(!0)}style={{justifySelf:"start",border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:700,cursor:"pointer"}}>
                        Delete account
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,display:"grid",gap:16,alignContent:"start"}}>
                  <div style={{display:"grid",gap:4}}>
                    <h3 style={{margin:0,fontSize:20}}>Security</h3>
                      <div style={{color:currentTheme.textMuted,fontSize:14}}>
                      We will email a secure password-reset link to the address on your account.
                    </div>
                  </div>
                  <button type="button"onClick={sendPasswordResetEmail}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer",justifySelf:"start",boxShadow:currentTheme.cardShadow,appearance:"none"}}>
                    Email password-reset link
                  </button>
                  {cloudStorageEnabled?null:<div style={{display:"grid",gap:14}}>
                    <Field id="password-reset-code"label="One-time reset code"value={passwordResetCodeInput}onChange={setPasswordResetCodeInput}/>
                    <Field id="password-reset-new"label="New password"type="password"value={passwordResetNewPassword}onChange={setPasswordResetNewPassword}/>
                    <Field id="password-reset-confirm"label="Confirm new password"type="password"value={passwordResetConfirmPassword}onChange={setPasswordResetConfirmPassword}/>
                    <button type="button"onClick={applyPasswordReset}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer",justifySelf:"start"}}>
                      Change password
                    </button>
                  </div>}
                </div>
              </div>

              <section style={{border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,display:"grid",gap:16}}>
                <div style={{display:"grid",gap:4}}>
                  <h3 style={{margin:0,fontSize:20}}>Theme</h3>
                  <div style={{color:currentTheme.textMuted,fontSize:14}}>
                    Choose the look you want to use across the signed-in simulator.
                  </div>
                </div>
                <div style={{display:"grid",gap:14,gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))"}}>
                  {Object.entries(THEME_DEFINITIONS).map(([themeId,theme])=>{const isSelected=currentUser?.themeId===themeId;return<button key={themeId}type="button"onClick={()=>applyThemeToProfile(themeId)}style={{border:isSelected?`2px solid ${theme.accent}`:`1px solid ${theme.cardBorder}`,background:theme.appBackground,borderRadius:16,padding:14,display:"grid",gap:12,cursor:"pointer",textAlign:"left"}}>
                        <div style={{display:"flex",gap:8}}>
                          {[theme.accent,theme.accentSoft,"#ffffff"].map(color=><span key={color}aria-hidden="true"style={{width:28,height:28,borderRadius:999,background:color,border:"1px solid rgba(148, 163, 184, 0.35)"}}/>)}
                        </div>
                        <div style={{display:"grid",gap:4}}>
                          <span style={{fontSize:15,fontWeight:700,color:theme.text}}>{theme.name}</span>
                          <span style={{fontSize:12,color:theme.textMuted}}>
                            {isSelected?"Current theme":"Apply this theme"}
                          </span>
                        </div>
                      </button>})}
                </div>
              </section>
            </section>
          </main>:activePage==="paycheck"?<PaycheckPage userId={currentUserId}onClose={()=>{setActivePage("simulator"),setActiveLoanTab("details"),setActiveView("assumed")}}/>:activePage==="budget"?<BudgetPage loans={savedLoans}theme={currentTheme}userId={currentUserId}onClose={()=>setActivePage("simulator")}/>:<main style={{display:"grid",gap:0,minWidth:0}}>
            <nav aria-label="Loan workspace"style={{display:"flex",alignItems:"end",borderBottom:`1px solid ${currentTheme.cardBorder}`}}>
              {[["details",accountType==="credit-card"?"Card Details":"Loan Details"],...accountType==="credit-card"?[["transactions","Transactions"]]:[],["history","Payoff Schedule"],["whatif","What If"]].map(([tab,label])=><button key={tab}type="button"onClick={()=>{setActiveLoanTab(tab),setActiveView(tab==="history"||tab==="whatif"?tab:"assumed")}}style={{flex:"1 1 0",marginBottom:-1,border:`1px solid ${currentTheme.cardBorder}`,borderBottomColor:activeLoanTab===tab?currentTheme.surface:currentTheme.cardBorder,borderRadius:"14px 14px 0 0",padding:"13px 16px",background:activeLoanTab===tab?currentTheme.surface:currentTheme.surfaceMuted,color:currentTheme.text,fontWeight:700,cursor:"pointer"}}>{label}</button>)}
            </nav>
            <div style={{display:"grid",gap:24,gridTemplateColumns:activeLoanTab==="details"||activeLoanTab==="transactions"?"minmax(0, 1fr)":"360px minmax(0, 1fr)",alignItems:"start",minWidth:0,paddingTop:20}}>
          <section style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,textAlign:"left",display:"grid",gridTemplateColumns:activeLoanTab==="details"?"repeat(auto-fit, minmax(280px, 1fr))":void 0,gap:16,boxShadow:currentTheme.cardShadow}}>
            <h2 style={{margin:0,fontSize:22,gridColumn:activeLoanTab==="details"||activeLoanTab==="transactions"?"1 / -1":void 0}}>
              {activeLoanTab==="details"?accountType==="credit-card"?"Credit Card Details":"Loan Details":activeLoanTab==="transactions"?"Transactions":activeLoanTab==="history"?"Payoff Schedule":"What If"}
            </h2>
            {activeLoanTab==="details"?<>
                <FormSection title="Loan basics">
                  <Field label={accountType==="credit-card"?"Credit card name":"Loan name"}id="loan-name"value={loanName}onChange={setLoanName}/>
                  <CurrencyField label={accountType==="credit-card"?"Current balance":"Starting principal"}id="starting-principal"value={startingPrincipal}onChange={setStartingPrincipal}/>
                  <Field label={accountType==="credit-card"?"Standard APR (%)":"APR (%)"}id="apr"value={aprPercent}onChange={setAprPercent}/>
                  {accountType==="credit-card"?<div style={{gridColumn:"1 / -1",display:"grid",gap:12,padding:14,borderRadius:14,background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`}}><strong>Credit card promotion</strong><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))",gap:12}}><label style={{display:"grid",gap:6}}><span style={{fontSize:13,fontWeight:650}}>Promotion type</span><select value={promoType}onChange={event=>setPromoType(event.target.value)}style={{boxSizing:"border-box",width:"100%",border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,padding:"10px 12px",background:currentTheme.surface,color:currentTheme.text}}><option value="none">No promotion</option><option value="zero">0% APR until a date</option><option value="deferred">Deferred interest until a date</option></select></label>{promoType!=="none"?<DateField label="Promotion end date"id="promo-end-date"value={promoEndDate}onChange={setPromoEndDate}/>:null}</div>{promoType==="zero"?<span style={{fontSize:12,color:currentTheme.textMuted}}>No interest accrues during the promotional period; the standard APR applies after the end date.</span>:promoType==="deferred"?<span style={{fontSize:12,color:currentTheme.textMuted}}>Deferred interest may be charged retroactively if the promotional balance is not paid by the end date.</span>:null}</div>:null}
                </FormSection>
                {accountType==="loan"?<FormSection title="Timeline">
                  <DateField label="Starting principal date"id="starting-date"value={startingPrincipalDate}onChange={setStartingPrincipalDate}/>
                  <DateField label="First scheduled payment date"id="first-payment-date"value={firstPaymentDate}minDate={startingPrincipalDate}onChange={setFirstPaymentDate}/>
                  <DateField label="Calculate current balance through"id="target-date"value={targetDate}minDate={targetDateMinValue}onChange={setTargetDate}/>
                </FormSection>:<FormSection title="Card account cycle"helper="The statement date starts the billing cycle; the due day is the deadline for that cycle's payment.">
                  <DateField label="Statement date"id="card-statement-date"value={cardStatementDate}onChange={setCardStatementDate}/>
                  <label style={{display:"grid",gap:6,width:96}}><span style={{fontSize:13,fontWeight:650}}>Due day</span><input id="card-due-day"inputMode="numeric"value={dueDay}onChange={event=>setDueDay(event.target.value.replace(/[^0-9]/g,"").slice(0,2))}style={{width:96,boxSizing:"border-box",border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,padding:"10px 12px",background:currentTheme.surface,color:currentTheme.text}}/></label>
                </FormSection>}
                <FormSection title="Recurring payment rules">
                  <div style={{display:"grid",gridTemplateColumns:"minmax(0, 1fr)",gap:10,minWidth:0}}>
                  {accountType==="credit-card"?<><label style={{display:"grid",gap:6,minWidth:0}}><span style={{fontSize:13,fontWeight:650}}>Minimum payment rule</span><select value={cardMinimumMode}onChange={event=>setCardMinimumMode(event.target.value)}style={{boxSizing:"border-box",width:"100%",minWidth:0,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,padding:"10px 12px",background:currentTheme.surface,color:currentTheme.text}}><option value="percent">Percentage of balance</option><option value="fixed">Fixed minimum</option></select></label>{cardMinimumMode==="percent"?<div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:10,minWidth:0,width:"100%"}}><div style={{minWidth:0,width:"100%"}}><Field label="Percent of balance"id="card-minimum-percent"value={cardMinimumPercent}onChange={setCardMinimumPercent}/></div><div style={{minWidth:0,width:"100%"}}><CurrencyField label="Minimum floor"id="card-minimum-floor"value={cardMinimumFloor}onChange={setCardMinimumFloor}/></div></div>:<CurrencyField label="Fixed minimum payment"id="minimum-payment"value={minimumPayment}onChange={setMinimumPayment}/>}</>:<CurrencyField label="Minimum payment"id="minimum-payment"value={minimumPayment}onChange={setMinimumPayment}/>}
                  <CurrencyField label="Monthly extra payment"id="additional-monthly-payment"value={additionalMonthlyPayment}onChange={setAdditionalMonthlyPayment}/>
                  {accountType==="loan"?<Field label="Recurring due day"id="due-day"value={dueDay}onChange={setDueDay}/>:<div style={{fontSize:12,color:currentTheme.textMuted}}>The projected minimum is recalculated from the balance each month.</div>}
                  </div>
                  {accountType==="credit-card"&&promoType!=="none"?<div style={{display:"grid",gap:10,padding:12,borderRadius:10,background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`}}><strong style={{fontSize:13}}>Payment rule after promotion ends</strong><span style={{fontSize:12,color:currentTheme.textMuted}}>Set the recurring minimum that begins after the 0% or deferred-interest period. This is separate from the promotional minimum above.</span><label style={{display:"grid",gap:6,minWidth:0}}><span style={{fontSize:13,fontWeight:650}}>Post-promotion minimum</span><select value={postPromoMinimumMode}onChange={event=>setPostPromoMinimumMode(event.target.value)}style={{boxSizing:"border-box",width:"100%",minWidth:0,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:10,padding:"10px 12px",background:currentTheme.surface,color:currentTheme.text}}><option value="percent">Percentage of balance</option><option value="fixed">Fixed amount</option></select></label>{postPromoMinimumMode==="percent"?<div style={{display:"grid",gridTemplateColumns:"repeat(2, minmax(0, 1fr))",gap:10,minWidth:0}}><Field label="Percent after promotion"id="post-promo-percent"value={postPromoMinimumPercent}onChange={setPostPromoMinimumPercent}/><CurrencyField label="Minimum floor after promotion"id="post-promo-floor"value={postPromoMinimumFloor}onChange={setPostPromoMinimumFloor}/></div>:<CurrencyField label="Fixed minimum after promotion"id="post-promo-fixed"value={postPromoFixedMinimum}onChange={setPostPromoFixedMinimum}/>}</div>:null}
                </FormSection>
                {accountType==="loan"?<FormSection title="Accrual / calendar behavior"helper="These rules control how scheduled dates and daily interest are calculated.">
                  <label style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                    <input type="checkbox"checked={moveWeekend}onChange={event=>setMoveWeekend(event.target.checked)}/>
                    Move scheduled due dates that fall on weekends to next weekday
                  </label>
                  <label style={{display:"flex",gap:10,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                    <input type="checkbox"checked={roundDailyInterest}onChange={event=>setRoundDailyInterest(event.target.checked)}/>
                    Round daily interest before summing
                  </label>
                  <div style={{display:"grid",gap:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Daily interest basis</span>
                    <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                        <input type="radio"name="day-count-basis"checked={dayCountBasis==="365"}onChange={()=>setDayCountBasis("365")}/>
                        Always divide APR by 365
                      </label>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                        <input type="radio"name="day-count-basis"checked={dayCountBasis==="actual-year"}onChange={()=>setDayCountBasis("actual-year")}/>
                        Use 366 during leap years
                      </label>
                    </div>
                    <span style={{fontSize:12,color:currentTheme.textMuted,lineHeight:1.4}}>
                      Your July 3, 2024 first-payment example strongly suggests your lender may be using 366 for 2024.
                    </span>
                  </div>
                </FormSection>:null}
                <div style={{gridColumn:"1 / -1",display:"flex",justifyContent:"flex-end"}}><button type="button"onClick={saveCurrentLoan}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#fff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:700,cursor:"pointer"}}>{currentLoanId?"Save changes":accountType==="credit-card"?"Create credit card":"Create loan"}</button></div>
              </>:activeLoanTab==="transactions"?<CreditCardActivityEditor theme={currentTheme}transactions={creditCardTransactions}onChange={setCreditCardTransactions}/>:activeLoanTab==="history"?<>
                <div style={{background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:12,padding:14,display:"grid",gap:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Add one-time payment</div>
                    <div style={{fontSize:12,color:currentTheme.textMuted,lineHeight:1.4,marginTop:4}}>
                      Insert a payment by date and amount. The payoff schedule will place it in the
                      correct order and recalculate from there.
                    </div>
                  </div>
                  <DateField id="new-one-off-date"label="Payment date"maxDate={todayValue}value={newOneOffDate}onChange={setNewOneOffDate}/>
                  <CurrencyField id="new-one-off-amount"label="Payment amount"value={newOneOffAmount}onChange={setNewOneOffAmount}/>
                  <Field id="new-one-off-label"label="Memo"value={newOneOffLabel}onChange={setNewOneOffLabel}/>
                  <button type="button"onClick={addOneOffPayment}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                    Add one-time payment
                  </button>
                </div>

                <div style={{background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:12,padding:14,display:"grid",gap:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Bulk adjust schedule</div>
                    <div style={{fontSize:12,color:currentTheme.textMuted,lineHeight:1.4,marginTop:4}}>
                      Apply a month-range change instead of editing several scheduled rows one at a time.
                    </div>
                  </div>
                  <div style={{display:"grid",gap:8}}>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="helper-bulk-mode"checked={helperBulkMode==="pause"}onChange={()=>setHelperBulkMode("pause")}/>
                      Pause / stop payments
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="helper-bulk-mode"checked={helperBulkMode==="monthly-extra"}onChange={()=>setHelperBulkMode("monthly-extra")}/>
                      Update monthly extra payment
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="helper-bulk-mode"checked={helperBulkMode==="minimum"}onChange={()=>setHelperBulkMode("minimum")}/>
                      Update minimum payment
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="helper-bulk-mode"checked={helperBulkMode==="due-day"}onChange={()=>setHelperBulkMode("due-day")}/>
                      Change payment due date
                    </label>
                  </div>
                  <MonthYearField id="helper-pause-from"label="From"maxMonth={helperMaxMonthValue}value={helperBulkMode==="pause"?helperPauseFromMonth:helperAdjustmentFromMonth}onChange={helperBulkMode==="pause"?setHelperPauseFromMonth:setHelperAdjustmentFromMonth}/>
                  <MonthYearField id="helper-pause-to"label="To"maxMonth={helperMaxMonthValue}value={helperBulkMode==="pause"?helperPauseToMonth:helperAdjustmentToMonth}onChange={helperBulkMode==="pause"?setHelperPauseToMonth:setHelperAdjustmentToMonth}/>
                  {helperBulkMode==="pause"?<div style={{display:"grid",gap:8}}>
                      <span style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Pause behavior</span>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                        <input type="radio"name="helper-pause-mode"checked={helperPauseMode==="accrues"}onChange={()=>setHelperPauseMode("accrues")}/>
                        Interest continues to accrue
                      </label>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                        <input type="radio"name="helper-pause-mode"checked={helperPauseMode==="paused"}onChange={()=>setHelperPauseMode("paused")}/>
                        Interest is paused
                      </label>
                    </div>:helperBulkMode==="due-day"?<Field id="helper-adjustment-due-day"label="New due day"value={helperAdjustmentDueDay}onChange={setHelperAdjustmentDueDay}/>:<CurrencyField id="helper-adjustment-amount"label={helperBulkMode==="minimum"?"New minimum payment":"New monthly extra payment"}value={helperAdjustmentAmount}onChange={setHelperAdjustmentAmount}/>}
                  <button type="button"onClick={addHelperBulkAdjustment}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                    {helperBulkMode==="pause"?"Apply pause":helperBulkMode==="due-day"?"Apply due-date change":"Apply adjustment"}
                  </button>
                  {helperActionError?<div style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:10,padding:"10px 12px",fontSize:13}}>
                      {helperActionError}
                    </div>:null}
                  {helperPausePeriods.length>0?<div style={{display:"grid",gap:8}}>
                      {helperPausePeriods.map(pausePeriod=><div key={pausePeriod.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",borderTop:`1px solid ${currentTheme.cardBorder}`,paddingTop:8}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode==="paused"?"interest paused":"interest accruing"}
                          </div>
                          <button type="button"onClick={()=>deleteHelperPausePeriod(pausePeriod.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                    </div>:null}
                  {helperRecurringChanges.length>0?<div style={{display:"grid",gap:8}}>
                      {helperRecurringChanges.map(change=><div key={change.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",borderTop:`1px solid ${currentTheme.cardBorder}`,paddingTop:8}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            {change.kind==="minimum"?"Minimum payment":"Monthly extra payment"} becomes{" "}
                            {formatCurrency(change.amount)} from {formatPauseRange({startMonth:change.effectiveDate,endMonth:change.endDate??change.effectiveDate,id:change.id,mode:"accrues"})}
                          </div>
                          <button type="button"onClick={()=>deleteHelperRecurringChange(change.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                    </div>:null}
                  {helperDueDayChanges.length>0?<div style={{display:"grid",gap:8}}>
                      {helperDueDayChanges.map(change=><div key={change.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap",borderTop:`1px solid ${currentTheme.cardBorder}`,paddingTop:8}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            Due day becomes {change.day} from {formatMonth(change.startMonth)}{change.endMonth?` through ${formatMonth(change.endMonth)}`:""}
                          </div>
                          <button type="button"onClick={()=>deleteHelperDueDayChange(change.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Delete</button>
                        </div>)}
                    </div>:null}
                </div>

                <button type="button"onClick={resetHelper}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  Reset all changes
                </button>
              </>:activeLoanTab==="whatif"?<>
                <div style={{background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:12,padding:14,display:"grid",gap:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Adjust projected payments</div>
                    <div style={{fontSize:12,color:currentTheme.textMuted,lineHeight:1.4,marginTop:4}}>
                      This starts from the payment-history balance as of the selected date, then applies
                      future payment changes to project a new payoff path.
                    </div>
                  </div>
                  <div style={{display:"grid",gap:8}}>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="what-if-entry-mode"checked={whatIfEntryMode==="one-time"}onChange={()=>setWhatIfEntryMode("one-time")}/>
                      Add one-time anticipated payment
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="what-if-entry-mode"checked={whatIfEntryMode==="monthly-extra"}onChange={()=>setWhatIfEntryMode("monthly-extra")}/>
                      Update monthly extra payment
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="what-if-entry-mode"checked={whatIfEntryMode==="minimum"}onChange={()=>setWhatIfEntryMode("minimum")}/>
                      Update minimum payment
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="what-if-entry-mode"checked={whatIfEntryMode==="pause"}onChange={()=>setWhatIfEntryMode("pause")}/>
                      Pause / forbearance
                    </label>
                    <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                      <input type="radio"name="what-if-entry-mode"checked={whatIfEntryMode==="due-day"}onChange={()=>setWhatIfEntryMode("due-day")}/>
                      Change payment due date
                    </label>
                  </div>
                  {whatIfEntryMode==="one-time"?<>
                      <DateField id="new-what-if-date"label="Future payment date"minDate={whatIfMinDateValue}value={newWhatIfDate}onChange={setNewWhatIfDate}/>
                      <CurrencyField id="new-what-if-amount"label="Payment amount"value={newWhatIfAmount}onChange={setNewWhatIfAmount}/>
                      <Field id="new-what-if-label"label="Memo"value={newWhatIfLabel}onChange={setNewWhatIfLabel}/>
                    </>:whatIfEntryMode==="pause"?<>
                      <MonthYearField id="what-if-pause-from"label="From"value={whatIfPauseFromMonth}onChange={setWhatIfPauseFromMonth}/>
                      <MonthYearField id="what-if-pause-to"label="To"value={whatIfPauseToMonth}onChange={setWhatIfPauseToMonth}/>
                      <div style={{display:"grid",gap:8}}>
                      <span style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Pause behavior</span>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                          <input type="radio"name="what-if-pause-mode"checked={whatIfPauseMode==="accrues"}onChange={()=>setWhatIfPauseMode("accrues")}/>
                          Interest continues to accrue
                        </label>
                      <label style={{display:"flex",gap:8,alignItems:"center",fontSize:14,color:currentTheme.text}}>
                          <input type="radio"name="what-if-pause-mode"checked={whatIfPauseMode==="paused"}onChange={()=>setWhatIfPauseMode("paused")}/>
                          Interest is paused
                        </label>
                      </div>
                    </>:whatIfEntryMode==="due-day"?<>
                      <MonthYearField id="what-if-adjustment-date"label="Beginning month"value={whatIfAdjustmentDate}onChange={setWhatIfAdjustmentDate}/>
                      <MonthYearField id="what-if-adjustment-end-date"label="Ending month (optional)"value={whatIfAdjustmentEndDate}onChange={setWhatIfAdjustmentEndDate}/>
                      <Field id="what-if-adjustment-due-day"label="New due day"value={whatIfAdjustmentDueDay}onChange={setWhatIfAdjustmentDueDay}/>
                    </>:<>
                      <MonthYearField id="what-if-adjustment-date"label="Month"value={whatIfAdjustmentDate}onChange={setWhatIfAdjustmentDate}/>
                      <MonthYearField id="what-if-adjustment-end-date"label="Ending month (optional)"value={whatIfAdjustmentEndDate}onChange={setWhatIfAdjustmentEndDate}/>
                      <Field id="what-if-adjustment-amount"label={whatIfEntryMode==="minimum"?"New minimum payment":"New monthly extra payment"}value={whatIfAdjustmentAmount}onChange={setWhatIfAdjustmentAmount}/>
                    </>}
                  <button type="button"onClick={addWhatIfPayment}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                    {whatIfEntryMode==="one-time"?"Add anticipated payment":whatIfEntryMode==="pause"?"Apply pause":whatIfEntryMode==="due-day"?"Apply due-date change":whatIfEntryMode==="minimum"?"Update minimum payment":"Update monthly extra payment"}
                  </button>
                  {whatIfActionError?<div style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:10,padding:"10px 12px",fontSize:13}}>
                      {whatIfActionError}
                    </div>:null}
                </div>

                <button type="button"onClick={resetWhatIf}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:10,padding:"10px 14px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                  Reset all changes
                </button>
              </>:null}
          </section>

          <section style={{display:activeLoanTab==="details"||activeLoanTab==="transactions"?"none":"grid",gap:24,textAlign:"left",width:"100%",minWidth:0}}>
            <div style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,display:"grid",gap:20,boxShadow:currentTheme.cardShadow}}>
              <div style={{display:"grid",gap:4}}>
                <h2 style={{margin:0,fontSize:22}}>{loanName||"Loan"} summary</h2>
                <div style={{fontSize:12,color:currentTheme.textMuted}}>Current state as of {targetDate||"-"}</div>
              </div>
              <div style={{display:"grid",gap:16,gridTemplateColumns:"repeat(6, minmax(0, 1fr))"}}>
                <SummaryValue label="APR"value={formatPercent(Number(aprPercent)||0)}/>
                <SummaryValue label="Starting balance"value={formatCurrency(parseCurrency(startingPrincipal))}/>
                <SummaryValue label="Minimum payment"value={formatCurrency(parseCurrency(minimumPayment))}/>
                <SummaryValue label="Monthly extra payment"value={formatCurrency(parseCurrency(additionalMonthlyPayment))}/>
                <SummaryValue label="Total scheduled payment"value={formatCurrency(parseCurrency(totalMonthlyPayment))}subtext="Minimum payment + monthly extra payment"/>
                <SummaryValue label="Next scheduled payment date"value={nextPaymentDate}/>
              </div>
              <div style={{display:"grid",gap:14}}>
                <SummaryGroupLabel label="OUTSTANDING BALANCES"/>
                <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(3, minmax(0, 1fr))"}}>
                  <SummaryValue label="Principal"value={formatCurrency(activeView==="assumed"?assumedResult.currentPrincipal:historyResult.currentPrincipal)}/>
                  <SummaryValue label="Interest"value={formatCurrency(activeView==="assumed"?assumedResult.currentInterest:historyResult.currentInterest)}/>
                  <SummaryValue label="Total balance"value={formatCurrency(activeView==="assumed"?assumedResult.totalBalance:historyResult.totalBalance)}emphasized tone="benchmark"/>
                </div>
              </div>
              <div style={{display:"grid",gap:14}}>
                <SummaryGroupLabel label="PAYOFF OUTLOOK"/>
                <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(3, minmax(0, 1fr))"}}>
                  <SummaryValue label="Payoff progress"value={formatPercent(activePayoffPercent)}emphasized subtext={<div style={{display:"grid",gap:8}}>
                        <div>{`You've paid off ${Math.round(activePayoffPercent)}% of your loan`}</div>
                        <div style={{width:"100%",height:8,borderRadius:999,background:currentTheme.isDark?"rgba(96, 165, 250, 0.18)":"#dbeafe",overflow:"hidden"}}>
                          <div style={{width:`${Math.max(0,Math.min(100,activePayoffPercent))}%`,height:"100%",background:`linear-gradient(90deg, ${currentTheme.accent}, ${currentTheme.isDark?"#93c5fd":"#38bdf8"})`,borderRadius:999}}/>
                        </div>
                      </div>}/>
                  <SummaryValue label="Projected payoff"value={formatMonthYear(activeProjectedPayoffDate)}emphasized subtext={activePayoffDuration==="-"?void 0:`~${activePayoffDuration} remaining`}/>
                  <SummaryValue label={<LabelWithNotes text="Time difference vs minimum-only plan"notes={[1]}/>}value={activeTimeSavedLabel}emphasized/>
                </div>
              </div>
              {negativeAmortizationWarning?<div style={{border:"1px solid #fbbf24",background:currentTheme.isDark?"rgba(146, 64, 14, 0.18)":"#fffbeb",color:"#92400e",borderRadius:12,padding:"12px 14px",fontSize:14,fontWeight:600}}>
                  Negative amortization detected: at least one cycle has a payment that does not
                  reduce principal, so the balance can grow.
                </div>:null}
              {!negativeAmortizationWarning&&softDangerMessage?<div style={{border:"1px solid #fde68a",background:currentTheme.isDark?"rgba(146, 64, 14, 0.18)":"#fffbeb",color:"#92400e",borderRadius:12,padding:"12px 14px",fontSize:14,fontWeight:600}}>
                  {softDangerMessage}
                </div>:null}
              <div style={{display:"grid",gap:12,padding:14,borderRadius:14,background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`}}>
                <div style={{fontSize:14,fontWeight:700,color:currentTheme.text}}>Additional details</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <button type="button"onClick={()=>setShowHistoricalDetails(value=>!value)}style={{border:`1px solid ${showHistoricalDetails?currentTheme.accent:currentTheme.cardBorder}`,background:showHistoricalDetails?currentTheme.accentSoft:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Historical details</button>
                  <button type="button"onClick={()=>setShowFutureDetails(value=>!value)}style={{border:`1px solid ${showFutureDetails?currentTheme.accent:currentTheme.cardBorder}`,background:showFutureDetails?currentTheme.accentSoft:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Future projection details</button>
                  <button type="button"onClick={()=>setShowLifetimeDetails(value=>!value)}style={{border:`1px solid ${showLifetimeDetails?currentTheme.accent:currentTheme.cardBorder}`,background:showLifetimeDetails?currentTheme.accentSoft:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Lifetime details</button>
                  {activeView==="whatif"?<button type="button"onClick={()=>setShowComparisonDetails(value=>!value)}style={{border:`1px solid ${showComparisonDetails?currentTheme.accent:currentTheme.cardBorder}`,background:showComparisonDetails?currentTheme.accentSoft:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Comparison details</button>:null}
                  <button type="button"onClick={()=>{setShowHistoricalDetails(!0),setShowFutureDetails(!0),setShowLifetimeDetails(!0),setShowComparisonDetails(activeView==="whatif")}}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Expand all</button>
                  <button type="button"onClick={()=>{setShowHistoricalDetails(!1),setShowFutureDetails(!1),setShowLifetimeDetails(!1),setShowComparisonDetails(!1)}}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"8px 12px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Collapse all</button>
                </div>
              </div>
              {activeView==="assumed"&&showHistoricalDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate||"-"}`}/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Principal paid"value={formatCurrency(assumedResult.totalPrincipalPaid)}/>
                      <SummaryValue label="Interest paid"value={formatCurrency(assumedResult.totalInterestPaid)}/>
                      <SummaryValue label={<LabelWithNotes text="Interest difference vs minimum-only plan"notes={[1]}/>}value={formatCurrency(assumedInterestSavedAsOfToday)}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="assumed"&&showFutureDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="REMAINING INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label={<LabelWithNotes text="Interest"notes={assumedRemainingInterestNotes}/>}value={formatCurrency(assumedScenarioRemainingInterest)}/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Additional interest cost",positive:"Additional interest saved",value:assumedScenarioRemainingSaved})}notes={assumedRemainingSavedNotes}/>}value={formatCurrency(Math.abs(assumedScenarioRemainingSaved))}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="assumed"&&showLifetimeDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="LIFETIME INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Minimum only payments"value={formatCurrency(minimumOnlyLifetimeInterest)}emphasized tone="benchmark"/>
                      <SummaryValue label={<LabelWithNotes text="Actual interest"notes={[3]}/>}value={formatCurrency(assumedScenarioLifetimeInterest)}emphasized/>
                      <SummaryValue label={<LabelWithNotes text="Daily interest cost"notes={[3]}/>}value={`${formatCurrency(activeDailyInterestCost)} / day`}emphasized/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Extra interest vs minimum-only plan",positive:"Interest saved vs minimum-only plan",value:assumedScenarioLifetimeSaved})}notes={assumedLifetimeSavedNotes}/>}value={formatCurrency(Math.abs(assumedScenarioLifetimeSaved))}emphasized tone={assumedLifetimeSavedTone}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="history"&&showHistoricalDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate||"-"}`}/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Principal paid"value={formatCurrency(historyResult.totalPrincipalPaid)}/>
                      <SummaryValue label="Interest paid"value={formatCurrency(historyResult.totalInterestPaid)}/>
                      <SummaryValue label={<LabelWithNotes text="Interest difference vs minimum-only plan"notes={[1]}/>}value={formatCurrency(helperInterestSavedAsOfToday)}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="history"&&showFutureDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="REMAINING INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label={<LabelWithNotes text="Interest"notes={helperRemainingInterestNotes}/>}value={formatCurrency(helperScenarioRemainingInterest)}/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Additional interest cost",positive:"Additional interest saved",value:helperScenarioRemainingSaved})}notes={helperRemainingSavedNotes}/>}value={formatCurrency(Math.abs(helperScenarioRemainingSaved))}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="history"&&showLifetimeDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="LIFETIME INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Minimum only payments"value={formatCurrency(minimumOnlyLifetimeInterest)}emphasized tone="benchmark"/>
                      <SummaryValue label={<LabelWithNotes text="Actual interest"notes={[3]}/>}value={formatCurrency(helperScenarioLifetimeInterest)}emphasized/>
                      <SummaryValue label={<LabelWithNotes text="Daily interest cost"notes={[3]}/>}value={`${formatCurrency(activeDailyInterestCost)} / day`}emphasized/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Extra interest vs minimum-only plan",positive:"Interest saved vs minimum-only plan",value:helperScenarioLifetimeSaved})}notes={helperLifetimeSavedNotes}/>}value={formatCurrency(Math.abs(helperScenarioLifetimeSaved))}emphasized tone={helperLifetimeSavedTone}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="whatif"&&showHistoricalDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label={`PAID AS OF ${targetDate||"-"}`}/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Principal paid"value={formatCurrency(historyResult.totalPrincipalPaid)}/>
                      <SummaryValue label="Interest paid"value={formatCurrency(historyResult.totalInterestPaid)}/>
                      <SummaryValue label={<LabelWithNotes text="Interest difference vs minimum-only plan"notes={[1]}/>}value={formatCurrency(helperInterestSavedAsOfToday)}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="whatif"&&showFutureDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="REMAINING INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label={<LabelWithNotes text="Interest"notes={whatIfRemainingInterestNotes}/>}value={formatCurrency(whatIfScenarioRemainingInterest)}/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Additional interest cost",positive:"Additional interest saved",value:whatIfProjectedExtrasSavedRemaining})}notes={whatIfAdditionalSavedNotes}/>}value={formatCurrency(Math.abs(whatIfProjectedExtrasSavedRemaining))}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="whatif"&&showLifetimeDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{display:"grid",gap:14}}>
                    <SummaryGroupLabel label="LIFETIME INTEREST"/>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label="Minimum only payments"value={formatCurrency(minimumOnlyLifetimeInterest)}emphasized tone="benchmark"/>
                      <SummaryValue label={<LabelWithNotes text="Actual interest"notes={[3]}/>}value={formatCurrency(whatIfScenarioLifetimeInterest)}emphasized/>
                      <SummaryValue label={<LabelWithNotes text="Daily interest cost"notes={[3]}/>}value={`${formatCurrency(activeDailyInterestCost)} / day`}emphasized/>
                      <SummaryValue label={<LabelWithNotes text={getDifferenceLabel({negative:"Extra interest vs minimum-only plan",positive:"Interest saved vs minimum-only plan",value:whatIfScenarioSaved})}notes={whatIfLifetimeSavedNotes}/>}value={formatCurrency(Math.abs(whatIfScenarioSaved))}emphasized tone={whatIfLifetimeSavedTone}/>
                    </div>
                  </div>
                </div>:null}
              {activeView==="whatif"&&showComparisonDetails?<div style={{display:"grid",gap:22}}>
                  <div style={{border:`1px solid ${currentTheme.isDark?currentTheme.accent:"#dbeafe"}`,background:currentTheme.isDark?"rgba(30, 58, 95, 0.45)":"#f8fbff",borderRadius:12,padding:14,display:"grid",gap:10}}>
                    <div style={{fontSize:13,fontWeight:700,color:currentTheme.isDark?"#93c5fd":"#1d4ed8"}}>
                      Current baseline plan vs what-if plan
                    </div>
                    <div style={{display:"grid",gap:12,gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))"}}>
                      <SummaryValue label={getDifferenceLabel({negative:"Interest difference vs current baseline",positive:"Interest difference vs current baseline",value:whatIfDeltaInterest})}value={formatCurrency(Math.abs(whatIfDeltaInterest))}subtext={whatIfDeltaInterest<0?"Higher than the current baseline":whatIfDeltaInterest>0?"Lower than the current baseline":void 0}/>
                      <SummaryValue label="Time difference vs current baseline"value={whatIfTimeChangeLabel}/>
                      <SummaryValue label="Payoff date vs current baseline"value={formatMonthYear(whatIfProjection.payoffDate)}subtext={`Current baseline: ${formatMonthYear(whatIfBaselinePayoffDate)}`}/>
                    </div>
                  </div>
                </div>:null}
              <div style={{display:"grid",gap:6,fontSize:12,color:currentTheme.textMuted,marginTop:4}}>
                <div>1. Compared to minimum-only payments.</div>
                <div>{footnote2Text}</div>
              </div>
            </div>

            {activeLoanTab==="details"?null:activeView==="assumed"?<>
                {assumedResult.errors.length>0?<div style={{display:"grid",gap:10}}>
                    {assumedResult.errors.map(error=><div key={error}style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:12,padding:12}}>
                        {error}
                      </div>)}
                  </div>:null}
                <div style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,width:"100%",minWidth:0,boxShadow:currentTheme.cardShadow}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:16}}>
                    <div>
                      <h2 style={{margin:0,fontSize:22}}>Assumed payment schedule</h2>
                      <p style={{margin:"8px 0 0",color:currentTheme.textMuted,fontSize:14}}>
                        This table is based only on the recurring minimum payment assumptions above.
                      </p>
                    </div>
                    <div style={{display:"grid",gap:8,justifyItems:"start",maxWidth:320}}>
                      <button type="button"onClick={()=>setShowAmortization(value=>!value)}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                        {showAmortization?"Hide future amortization":"Show future amortization"}
                      </button>
                    </div>
                  </div>

                  {canShowAssumedSchedule?assumedResult.errors.length>0?<div style={{border:`1px dashed ${currentTheme.cardBorder}`,borderRadius:12,padding:16,color:currentTheme.textMuted}}>
                      Enter the loan inputs to build the assumed schedule.
                    </div>:<div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
                        <colgroup>
                          <col style={{width:"13%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"11%"}}/>
                          <col style={{width:"13%"}}/>
                          <col style={{width:"13%"}}/>
                          <col style={{width:"14%"}}/>
                        </colgroup>
                        <thead>
                          <tr style={{background:currentTheme.surfaceMuted}}>
                            {["Date","Payment","Interest paid","Principal paid","% to principal","Outstanding principal","Outstanding interest","Total outstanding balance"].map(heading=><th key={heading}style={{padding:"10px 8px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14,textAlign:"left",color:currentTheme.textMuted}}>
                                {heading}
                              </th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(showAmortization?amortizationProjection.rows:assumedResult.rows).map(row=><tr key={`${row.eventType}-${row.label}-${row.paymentDate.toISOString()}`}style={getTableRowStyle(row)}>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14,whiteSpace:"nowrap"}}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType==="paused"&&row.accruedInterest>0?<div style={{fontSize:12,color:"#b45309"}}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization?<div style={{fontSize:12,color:"#b45309"}}>Negative amortization</div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{padding:"12px 10px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14}}>{formatCurrency(row.endingPrincipal+row.endingInterest)}</td>
                            </tr>)}
                        </tbody>
                      </table>
                    </div>:<div style={{border:`1px dashed ${currentTheme.cardBorder}`,borderRadius:12,padding:16,color:currentTheme.textMuted}}>
                      Enter both the starting principal date and first scheduled payment date to show
                      the assumed schedule.
                    </div>}
                </div>
              </>:activeView==="history"?<>
                {historyErrors.length>0?<div style={{display:"grid",gap:10}}>
                    {historyErrors.map(error=><div key={error}style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:12,padding:12}}>
                        {error}
                      </div>)}
                  </div>:null}
                {helperActionError?<div style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:12,padding:12}}>
                    {helperActionError}
                  </div>:null}

                <div style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,width:"100%",minWidth:0,boxShadow:currentTheme.cardShadow}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:8}}>
                    <h2 style={{margin:0,fontSize:22}}>Payment timeline</h2>
                    <div style={{display:"grid",gap:8,justifyItems:"start",maxWidth:320}}>
                      <button type="button"onClick={()=>{cancelEditingPayment(),setShowHelperAmortization(value=>!value)}}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:999,padding:"10px 16px",fontSize:14,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                        {showHelperAmortization?"Hide future amortization":"Show future amortization"}
                      </button>
                    </div>
                  </div>
                  <p style={{margin:"0 0 16px",color:currentTheme.textMuted,fontSize:14}}>
                    Edit payment dates and amounts directly here, add extra payments, or delete rows.
                    The payoff schedule recalculates through the `As of target date` row.
                  </p>
                  {(showHelperAmortization?helperProjection.rows:historyResult.rows).length===0?<div style={{border:`1px dashed ${currentTheme.cardBorder}`,borderRadius:12,padding:16,color:currentTheme.textMuted}}>
                      Add loan inputs and payment history to see the replay.
                    </div>:<div style={{width:"100%",minWidth:0}}>
                      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
                        <colgroup>
                          <col style={{width:"4%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"9%"}}/>
                          <col style={{width:"8%"}}/>
                          <col style={{width:"9%"}}/>
                          <col style={{width:"9%"}}/>
                          <col style={{width:"7%"}}/>
                          <col style={{width:"10%"}}/>
                          <col style={{width:"10%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"10%"}}/>
                        </colgroup>
                        <thead>
                          <tr style={{background:currentTheme.surfaceMuted}}>
                            {["Type","Memo","Date","Payment","Interest paid","Principal paid","% to principal","Outstanding principal","Outstanding interest","Total outstanding balance","Actions"].map(heading=><th key={heading}style={{padding:"9px 5px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:12,textAlign:"left",color:currentTheme.textMuted}}>
                                {heading}
                              </th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {(showHelperAmortization?helperProjection.rows:historyResult.rows).map(row=><tr key={row.rowId}style={getTableRowStyle(row)}>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14,whiteSpace:"nowrap"}}title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                {editingPaymentId===row.rowId?<input type="text"value={editingPaymentLabel}onChange={event=>setEditingPaymentLabel(event.target.value)}style={{border:"1px solid #cbd5e1",borderRadius:8,padding:"6px 8px",fontSize:12,width:"100%",minWidth:0}}/>:row.label}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14,whiteSpace:"nowrap"}}>
                                {editingPaymentId===row.rowId?<div style={{width:"100%",minWidth:0}}>
                                    <DatePickerInput compact maxDate={todayValue}value={editingPaymentDate}onChange={setEditingPaymentDate}/>
                                  </div>:toDateInputValue(row.paymentDate)}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                {editingPaymentId===row.rowId?<CurrencyInput compact value={editingPaymentAmount}onChange={setEditingPaymentAmount}/>:formatCurrency(row.paymentAmount)}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType==="paused"&&row.accruedInterest>0?<div style={{fontSize:12,color:"#b45309"}}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization?<div style={{fontSize:12,color:"#b45309"}}>Negative amortization</div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingPrincipal+row.endingInterest)}</td>
                              <td style={{padding:"8px 5px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:12}}>
                                {row.eventType==="snapshot"||row.eventType==="paused"||showHelperAmortization?<span style={{color:currentTheme.textMuted,fontSize:12}}>Auto</span>:editingPaymentId===row.rowId?<div style={{display:"flex",gap:5,justifyContent:"center"}}>
                                    <button type="button"aria-label="Edit payment"title="Edit payment"onClick={saveEditedPayment}style={{border:`1px solid ${currentTheme.accent}`,background:currentTheme.accent,color:"#ffffff",borderRadius:8,padding:6,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                                      Save
                                    </button>
                                    <button type="button"onClick={cancelEditingPayment}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                                      Cancel
                                    </button>
                                  </div>:<div style={{display:"grid",gap:5}}>
                                    <button type="button"onClick={()=>startEditingReplayRow(row)}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                                      <svg aria-hidden="true"width="14"height="14"viewBox="0 0 24 24"fill="none"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Zm10-12 3 3"stroke="currentColor"strokeWidth="1.7"strokeLinecap="round"strokeLinejoin="round"/></svg>
                                    </button>
                                    <button type="button"aria-label="Delete payment"title="Delete payment"onClick={()=>deleteHelperRow(row.rowId)}style={{border:"1px solid #ef4444",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #b91c1c)",borderRadius:8,padding:6,fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>
                                      <svg aria-hidden="true"width="14"height="14"viewBox="0 0 24 24"fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5"stroke="currentColor"strokeWidth="1.7"strokeLinecap="round"strokeLinejoin="round"/></svg>
                                    </button>
                                  </div>}
                              </td>
                            </tr>)}
                        </tbody>
                      </table>
                    </div>}
                </div>
              </>:<>
                {loanInputsReady&&(historyErrors.length>0||whatIfProjection.errors.length>0)?<div style={{display:"grid",gap:10}}>
                    {[...historyErrors,...whatIfProjection.errors].map((error,index)=><div key={`${error}-${index}`}style={{border:"1px solid var(--app-danger-border, #fecaca)",background:"var(--app-danger-bg, #fff1f2)",color:"var(--app-danger-text, #991b1b)",borderRadius:12,padding:12}}>
                        {error}
                      </div>)}
                  </div>:null}

                <div style={{background:currentTheme.surface,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,padding:20,width:"100%",minWidth:0,boxShadow:currentTheme.cardShadow}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <h2 style={{margin:0,fontSize:22}}>What If Projection</h2>
                      <p style={{margin:"8px 0 0",color:currentTheme.textMuted,fontSize:14}}>
                        This starts from the payment-history balance as of {targetDate||"today"} and
                        then applies your future payment adjustments to project a new payoff path.
                      </p>
                    </div>
                    <div/>
                  </div>
                  {whatIfPayments.length>0||whatIfRecurringChanges.length>0||whatIfPausePeriods.length>0||whatIfDueDayChanges.length>0?<div style={{background:currentTheme.surfaceMuted,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:12,padding:14,marginBottom:16,display:"grid",gap:10}}>
                      <div style={{fontSize:14,fontWeight:600,color:currentTheme.text}}>Projected payment changes</div>
                      {whatIfPausePeriods.map(pausePeriod=><div key={pausePeriod.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            Pause payments from {formatPauseRange(pausePeriod)} with{" "}
                            {pausePeriod.mode==="paused"?"interest paused":"interest accruing"}
                          </div>
                          <button type="button"onClick={()=>deleteWhatIfPausePeriod(pausePeriod.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                      {whatIfRecurringChanges.map(change=><div key={change.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            {change.kind==="minimum"?"Minimum payment":"Monthly extra"} becomes{" "}
                            {formatCurrency(change.amount)} starting in {formatMonth(change.effectiveDate)}
                          </div>
                          <button type="button"onClick={()=>deleteWhatIfRecurringChange(change.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                      {whatIfDueDayChanges.map(change=><div key={change.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            Due day becomes {change.day} starting in {formatMonth(change.startMonth)}{change.endMonth?` through ${formatMonth(change.endMonth)}`:""}
                          </div>
                          <button type="button"onClick={()=>deleteWhatIfDueDayChange(change.id)}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                      {whatIfPayments.map(payment=><div key={payment.id}style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                          <div style={{color:currentTheme.textMuted,fontSize:14}}>
                            {payment.label} on {toDateInputValue(payment.date)} for {formatCurrency(payment.amount)}
                          </div>
                          <button type="button"onClick={()=>deleteWhatIfPayment(payment.id??"")}style={{border:"1px solid #ef4444",background:currentTheme.surface,color:"#b91c1c",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>
                            Delete
                          </button>
                        </div>)}
                    </div>:null}
                  {whatIfProjection.rows.length===0?<div style={{border:`1px dashed ${currentTheme.cardBorder}`,borderRadius:12,padding:16,color:currentTheme.textMuted}}>
                      Add loan inputs first, then add payments in Payoff Schedule if needed. This tab will project
                      forward from the current balance date.
                    </div>:<div style={{overflowX:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",tableLayout:"fixed"}}>
                        <colgroup>
                          <col style={{width:"5%"}}/>
                          <col style={{width:"16%"}}/>
                          <col style={{width:"11%"}}/>
                          <col style={{width:"11%"}}/>
                          <col style={{width:"11%"}}/>
                          <col style={{width:"11%"}}/>
                          <col style={{width:"8%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"12%"}}/>
                          <col style={{width:"13%"}}/>
                        </colgroup>
                        <thead>
                          <tr style={{background:currentTheme.surfaceMuted}}>
                            {["Type","Memo","Date","Payment","Interest paid","Principal paid","% to principal","Outstanding principal","Outstanding interest","Total outstanding balance"].map(heading=><th key={heading}style={{padding:"10px 8px",borderBottom:`1px solid ${currentTheme.cardBorder}`,fontSize:14,textAlign:"left",color:currentTheme.textMuted}}>
                                {heading}
                              </th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {whatIfProjection.rows.map(row=><tr key={row.rowId}style={getTableRowStyle(row)}>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14,whiteSpace:"nowrap"}}title={getEventTypeTitle(row.eventType)}>{getEventTypeCode(row.eventType)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{row.label}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14,whiteSpace:"nowrap"}}>{toDateInputValue(row.paymentDate)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.paymentAmount)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                <div>{formatCurrency(row.interestPaid)}</div>
                                {row.eventType==="paused"&&row.accruedInterest>0?<div style={{fontSize:12,color:"#b45309"}}>
                                    Accrued {formatCurrency(row.accruedInterest)}
                                  </div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.principalPaid)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>
                                <div>{formatPrincipalShare(row.principalShareOfPayment)}</div>
                                {row.negativeAmortization?<div style={{fontSize:12,color:"#b45309"}}>Negative amortization</div>:null}
                              </td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingPrincipal)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingInterest)}</td>
                              <td style={{padding:"12px 10px",borderBottom:"1px solid #eef2f7",fontSize:14}}>{formatCurrency(row.endingPrincipal+row.endingInterest)}</td>
                            </tr>)}
                        </tbody>
                      </table>
                    </div>}
                </div>
              </>}
          </section>
            </div>
        </main>}
        {deleteAccountConfirmOpen?<div role="presentation"onMouseDown={event=>{event.target===event.currentTarget&&setDeleteAccountConfirmOpen(!1)}}style={{position:"fixed",inset:0,zIndex:100,display:"grid",placeItems:"center",padding:20,background:"rgba(15, 23, 42, 0.58)"}}>
            <div role="alertdialog"aria-modal="true"aria-labelledby="delete-account-title"style={{width:"min(460px, 100%)",display:"grid",gap:18,padding:24,border:`1px solid ${currentTheme.cardBorder}`,borderRadius:18,background:currentTheme.surface,boxShadow:"0 28px 70px rgba(15, 23, 42, 0.3)"}}>
              <div style={{display:"grid",gap:8}}>
                <h2 id="delete-account-title"style={{margin:0,fontSize:22}}>Delete your account?</h2>
                <p style={{margin:0,color:currentTheme.textMuted,lineHeight:1.6}}>This permanently deletes your profile, saved loans, and paycheck plans. This action is irreversible.</p>
              </div>
              <div style={{display:"flex",justifyContent:"flex-end",gap:10}}>
                <button type="button"onClick={()=>setDeleteAccountConfirmOpen(!1)}style={{border:`1px solid ${currentTheme.cardBorder}`,background:currentTheme.surface,color:currentTheme.text,borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer"}}>Cancel</button>
                <button type="button"onClick={()=>{deleteCurrentUserProfile()}}style={{border:"1px solid #dc2626",background:"#dc2626",color:"#fff",borderRadius:10,padding:"10px 14px",fontWeight:700,cursor:"pointer"}}>Delete account</button>
              </div>
            </div>
          </div>:null}
        </div>
      </div>
    </div>}
