import { Field } from "../components/ui/Field";

type AuthMode = "login" | "create";

type LoginPageProps = {
  authDisplayName: string;
  authError: string;
  authMode: AuthMode;
  authName: string;
  authPassword: string;
  cloudStorageEnabled: boolean;
  onAuthDisplayNameChange: (value: string) => void;
  onAuthErrorChange: (value: string) => void;
  onAuthModeChange: (value: AuthMode) => void;
  onAuthNameChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onSubmit: () => void;
};

export function LoginPage({
  authDisplayName,
  authError,
  authMode,
  authName,
  authPassword,
  cloudStorageEnabled,
  onAuthDisplayNameChange,
  onAuthErrorChange,
  onAuthModeChange,
  onAuthNameChange,
  onAuthPasswordChange,
  onSubmit,
}: LoginPageProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 240px, #f8fafc 100%)",
        padding: "24px 16px 48px",
        color: "var(--app-text, #0f172a)",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#ffffff",
          border: "1px solid #dbe2ea",
          borderRadius: 20,
          padding: 24,
          display: "grid",
          gap: 18,
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.1 }}>Loan Interest Simulator</h1>
          <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
            {cloudStorageEnabled
              ? "Sign in with Supabase to sync saved loans across browsers and devices."
              : "Configure Supabase authentication to sign in and access your saved loans."}
          </div>
        </div>
        {!cloudStorageEnabled ? (
          <div style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            Supabase is not configured for this deployment. Authentication is unavailable until the Vercel Supabase environment variables are set.
          </div>
        ) : null}
        <div style={{ display: cloudStorageEnabled ? "flex" : "none", gap: 10 }}>
          <button
            type="button"
            onClick={() => { onAuthModeChange("login"); onAuthErrorChange(""); onAuthDisplayNameChange(""); }}
            style={{
              border: authMode === "login" ? "1px solid var(--app-accent, #2563eb)" : "1px solid #cbd5e1",
              background: authMode === "login" ? "var(--app-accent-soft, #dbeafe)" : "#ffffff",
              color: "#0f172a",
              borderRadius: 999,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { onAuthModeChange("create"); onAuthErrorChange(""); }}
            style={{
              border: authMode === "create" ? "1px solid var(--app-accent, #2563eb)" : "1px solid #cbd5e1",
              background: authMode === "create" ? "var(--app-accent-soft, #dbeafe)" : "#ffffff",
              color: "#0f172a",
              borderRadius: 999,
              padding: "10px 16px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Create account
          </button>
        </div>
        <div style={{ display: cloudStorageEnabled ? "grid" : "none", gap: 12 }}>
          {authMode === "create" ? <Field id="auth-display-name" label="Your name" value={authDisplayName} onChange={onAuthDisplayNameChange} /> : null}
          <Field id="auth-name" label="Email" value={authName} onChange={onAuthNameChange} />
          <Field id="auth-password" label="Password" type="password" value={authPassword} onChange={onAuthPasswordChange} />
          {authError ? (
            <div style={{ border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
              {authError}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onSubmit}
            style={{
              border: "1px solid var(--app-accent, #2563eb)",
              background: "var(--app-accent, #2563eb)",
              color: "#ffffff",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {authMode === "login" ? "Login" : "Create account"}
          </button>
        </div>
      </div>
    </div>
  );
}
