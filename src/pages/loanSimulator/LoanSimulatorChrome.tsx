import type { LoanSimulatorRuntime } from "../../types/loanSimulatorRuntime";


import { PaycheckPage } from "../PaycheckPage";
import { DebtOverview } from "../DebtOverviewPage";
import { BudgetPage } from "../BudgetPage";






import { Field } from "../../components/ui/Field";







import { formatCurrency, formatMonthYear } from "../../utils/formatting";
import { THEME_DEFINITIONS, type ThemeId } from "../../constants/theme";


export function LoanSimulatorChrome({ runtime }: {runtime: LoanSimulatorRuntime;}) {
  const { currentUserId, activePage, setActivePage, setActiveLoanTab, profileMenuOpen, setProfileMenuOpen, setDeleteAccountConfirmOpen, profileMenuRef, profileDraftName, setProfileDraftName, profileDraftEmail, setProfileDraftEmail, profileStatus, savedLoans, saveStatus, setActiveView, currentUser, currentTheme, firstName, profileInitial, logoutUser, saveProfileDetails, applyThemeToProfile, sendPasswordResetEmail, headerLoans = [], headerProjection = { startingTotal: 0, payoffDate: null }, headerProgress = 0 } = runtime;
  return (
    <>
              <header style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "space-between", textAlign: "left" }}>
                <button type="button" onClick={() => {setActivePage("simulator");setActiveLoanTab("details");setActiveView("assumed");}} style={{ display: "flex", gap: 14, alignItems: "center", border: 0, padding: 0, background: "transparent", color: currentTheme.text, cursor: "pointer", textAlign: "left" }}>
                  <span aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 14, background: `linear-gradient(135deg, ${currentTheme.accent}, ${currentTheme.accent})`, boxShadow: currentTheme.cardShadow, flexShrink: 0 }} />
                  <span>
                    <span style={{ display: "block", fontSize: 34, fontWeight: 750, lineHeight: 1.1 }}>DebtLab</span>
                    <span style={{ display: "block", marginTop: 6, color: currentTheme.textMuted, fontSize: 15 }}>
                      {activePage === "paycheck" ? "Estimate pay and annual taxes." : activePage === "budget" ? "Track recurring bills and available cash flow." : activePage === "profile" ? "Manage your account and preferences." : activePage === "overview" ? "Compare payoff strategies across all saved loans." : "Model loan payments and plan your payoff."}
                    </span>
                  </span>
                </button>
                {headerLoans.length > 0 ? <button type="button" onClick={() => setActivePage("overview")} style={{ marginLeft: "auto", minWidth: 320, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 16px", border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, padding: "10px 14px", background: currentTheme.surface, color: currentTheme.text, textAlign: "left", cursor: "pointer", boxShadow: currentTheme.cardShadow }}><span style={{ fontSize: 11, color: currentTheme.textMuted }}>Remaining debt</span><span style={{ fontSize: 11, color: currentTheme.textMuted }}>Estimated payoff</span><strong>{formatCurrency(headerProjection.startingTotal)}</strong><strong>{formatMonthYear(headerProjection.payoffDate)}</strong><span style={{ gridColumn: "1 / 3", height: 5, borderRadius: 999, overflow: "hidden", background: currentTheme.surfaceMuted }}><span style={{ display: "block", width: `${headerProgress}%`, height: "100%", background: currentTheme.accent }} /></span></button> : null}
                <div ref={profileMenuRef} style={{ position: "relative" }}>
                  <button type="button" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)} style={{ display: "flex", gap: 10, alignItems: "center", border: `1px solid ${currentTheme.cardBorder}`, background: currentTheme.surface, color: currentTheme.text, borderRadius: 999, padding: "7px 12px 7px 7px", fontWeight: 700, cursor: "pointer", boxShadow: currentTheme.cardShadow }}>
                    <span aria-hidden="true" style={{ width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: "50%", background: currentTheme.accent, color: "#fff", fontSize: 14 }}>{profileInitial}</span>
                    <span>Welcome, {firstName}</span>
                    <span aria-hidden="true" style={{ fontSize: 11, color: currentTheme.textMuted }}>{profileMenuOpen ? "ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â²" : "ÃƒÂ¢Ã¢â‚¬â€œÃ‚Â¼"}</span>
                  </button>
                  {profileMenuOpen ?
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 30, width: 220, padding: 8, display: "grid", gap: 4, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 14, background: currentTheme.surface, boxShadow: "0 18px 40px rgba(15, 23, 42, 0.18)" }}>
                      {[
            { label: "View profile", action: () => setActivePage("profile") },
            { label: "Pay & tax estimator", action: () => setActivePage("paycheck") },
            { label: "Bills & budget", action: () => setActivePage("budget") },
            { label: "Log out", action: logoutUser }].
            map((item) =>
            <button key={item.label} type="button" onClick={() => {setProfileMenuOpen(false);item.action?.();}} style={{ border: 0, borderRadius: 9, padding: "10px 12px", background: "transparent", color: currentTheme.text, textAlign: "left", fontWeight: 600, cursor: "pointer" }}>{item.label}</button>
            )}
                    </div> :
          null}
                </div>
              </header>
              {saveStatus.startsWith("Saved") ? <div role="status" style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 12, padding: "10px 14px", background: currentTheme.surface, color: currentTheme.text, boxShadow: currentTheme.cardShadow, fontWeight: 700 }}>{saveStatus}</div> : null}
              {activePage === "overview" ?
      <DebtOverview loans={savedLoans} theme={currentTheme} userId={currentUserId ?? ""} /> :
      activePage === "profile" ?
      <main
        style={{
          display: "grid",
          gap: 24
        }}>
        
                  <section
          style={{
            background: currentTheme.surface,
            border: `1px solid ${currentTheme.cardBorder}`,
            borderRadius: 20,
            padding: 24,
            boxShadow: currentTheme.cardShadow,
            display: "grid",
            gap: 24
          }}>
          
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
                      <div style={{ display: "grid", gap: 8 }}>
                      <h2 style={{ margin: 0, fontSize: 28 }}>Profile</h2>
                      <p style={{ margin: 0, color: currentTheme.textMuted, lineHeight: 1.6, maxWidth: 760 }}>
                        Keep your account details up to date, pick a theme for the simulator, and use a one-time reset code emailed to you when you want to change your password.
                      </p>
                      </div>
                      <button type="button" aria-label="Close profile" onClick={() => {setActivePage("simulator");setActiveLoanTab("details");setActiveView("assumed");}} style={{ width: 38, height: 38, border: `1px solid ${currentTheme.cardBorder}`, borderRadius: 10, background: currentTheme.surface, color: currentTheme.text, fontSize: 22, cursor: "pointer" }}>ÃƒÆ’Ã¢â‚¬â€</button>
                    </div>
      
                    {profileStatus ?
          <div
            style={{
              border: `1px solid ${currentTheme.cardBorder}`,
              background: currentTheme.accentSoft,
              color: currentTheme.text,
              borderRadius: 14,
              padding: "12px 14px",
              fontSize: 14
            }}>
            
                        {profileStatus}
                      </div> :
          null}
      
                    <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)"
            }}>
            
                      <div
              style={{
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 18,
                padding: 20,
                display: "grid",
                gap: 16,
                alignContent: "start"
              }}>
              
                        <div style={{ display: "grid", gap: 4 }}>
                          <h3 style={{ margin: 0, fontSize: 20 }}>Account details</h3>
                            <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            Your username stays the same for login. Your profile name is what shows in the app.
                          </div>
                        </div>
                        <div style={{ display: "grid", gap: 14 }}>
                          <div style={{ display: "grid", gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600, color: currentTheme.text }}>Username</span>
                            <div
                    style={{
                      border: `1px solid ${currentTheme.cardBorder}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      fontSize: 15,
                      background: currentTheme.surfaceMuted,
                      color: currentTheme.textMuted
                    }}>
                    
                              {currentUser?.name}
                            </div>
                          </div>
                          <Field
                  id="profile-display-name"
                  label="Your name"
                  value={profileDraftName}
                  onChange={setProfileDraftName} />
                
                          <Field
                  id="profile-email"
                  label="Email"
                  value={profileDraftEmail}
                  onChange={setProfileDraftEmail} />
                
                          <button
                  type="button"
                  onClick={() => { void saveProfileDetails?.(); }}
                  style={{
                    border: `1px solid ${currentTheme.accent}`,
                    background: currentTheme.accent,
                    color: "#ffffff",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    justifySelf: "start"
                  }}>
                  
                            Save profile
                          </button>
                          <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${currentTheme.cardBorder}`, display: "grid", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: currentTheme.text }}>Delete account</div>
                            <div style={{ fontSize: 12, lineHeight: 1.5, color: currentTheme.textMuted }}>Permanently remove your profile and all saved loan data.</div>
                            <button type="button" onClick={() => setDeleteAccountConfirmOpen(true)} style={{ justifySelf: "start", border: "1px solid #ef4444", background: currentTheme.surface, color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                              Delete account
                            </button>
                          </div>
                        </div>
                      </div>
      
                      <div
              style={{
                border: `1px solid ${currentTheme.cardBorder}`,
                borderRadius: 18,
                padding: 20,
                display: "grid",
                gap: 16,
                alignContent: "start"
              }}>
              
                        <div style={{ display: "grid", gap: 4 }}>
                          <h3 style={{ margin: 0, fontSize: 20 }}>Security</h3>
                            <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                            We will email a secure password-reset link to the address on your account.
                          </div>
                        </div>
                        <button
                type="button"
                onClick={() => { void sendPasswordResetEmail?.(); }}
                style={{
                  border: `1px solid ${currentTheme.accent}`,
                  background: currentTheme.accent,
                  color: "#ffffff",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  justifySelf: "start",
                  boxShadow: currentTheme.cardShadow,
                  appearance: "none"
                }}>
                
                          Email password-reset link
                        </button>
                      </div>
                    </div>
      
                    <section
            style={{
              border: `1px solid ${currentTheme.cardBorder}`,
              borderRadius: 18,
              padding: 20,
              display: "grid",
              gap: 16
            }}>
            
                      <div style={{ display: "grid", gap: 4 }}>
                        <h3 style={{ margin: 0, fontSize: 20 }}>Theme</h3>
                        <div style={{ color: currentTheme.textMuted, fontSize: 14 }}>
                          Choose the look you want to use across the signed-in simulator.
                        </div>
                      </div>
                      <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
              }}>
              
                        {Object.entries(THEME_DEFINITIONS).map(([themeId, theme]) => {
                const isSelected = currentUser?.themeId === themeId;
                return (
                  <button
                    key={themeId}
                    type="button"
                    onClick={() => { void applyThemeToProfile?.(themeId as ThemeId); }}
                    style={{
                      border: isSelected ? `2px solid ${theme.accent}` : `1px solid ${theme.cardBorder}`,
                      background: theme.appBackground,
                      borderRadius: 16,
                      padding: 14,
                      display: "grid",
                      gap: 12,
                      cursor: "pointer",
                      textAlign: "left"
                    }}>
                    
                              <div style={{ display: "flex", gap: 8 }}>
                                {[theme.accent, theme.accentSoft, "#ffffff"].map((color) =>
                      <span
                        key={color}
                        aria-hidden="true"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          background: color,
                          border: "1px solid rgba(148, 163, 184, 0.35)"
                        }} />

                      )}
                              </div>
                              <div style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{theme.name}</span>
                                <span style={{ fontSize: 12, color: theme.textMuted }}>
                                  {isSelected ? "Current theme" : "Apply this theme"}
                                </span>
                              </div>
                            </button>);

              })}
                      </div>
                    </section>
                  </section>
                </main> :
      activePage === "paycheck" ?
      <PaycheckPage userId={currentUserId ?? ""} onClose={() => {setActivePage("simulator");setActiveLoanTab("details");setActiveView("assumed");}} /> :
      activePage === "budget" ?
      <BudgetPage loans={savedLoans} theme={currentTheme} userId={currentUserId ?? ""} onClose={() => setActivePage("simulator")} /> :
      null}
    </>);

}





