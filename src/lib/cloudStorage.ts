import { isSupabaseConfigured, supabase, supabaseConfigStatus } from "./supabase";

export type CloudUserProfile = {
  displayName: string;
  email: string;
  id: string;
  name: string;
  password: string;
  passwordResetCode?: string;
  passwordResetIssuedAt?: string;
  themeId: string;
  needsEmailConfirmation?: boolean;
};

export type CloudSavedLoanRecord = {
  data: unknown;
  id: string;
  name: string;
};

type ProfileRow = {
  display_name: string;
  email: string;
  id: string;
  theme_id: string;
  username: string;
};

type SavedLoanRow = {
  data: unknown;
  id: string;
  name: string;
};

const assertClient = () => {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
};

const mapProfile = (row: ProfileRow): CloudUserProfile => ({
  displayName: row.display_name,
  email: row.email,
  id: row.id,
  name: row.username,
  password: "",
  themeId: row.theme_id,
});

export const cloudStorageEnabled = isSupabaseConfigured;
export const cloudStorageStatus = supabaseConfigStatus;

export const getCloudSessionProfile = async () => {
  const client = assertClient();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const user = sessionData.session?.user;
  if (!user) return null;

  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, email, theme_id")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (error) throw error;
  return mapProfile(data);
};

export const createCloudProfile = async (email: string, password: string) => {
  const client = assertClient();
  const normalizedEmail = email.trim().toLowerCase();
  const displayName = normalizedEmail.split("@")[0] || normalizedEmail;

  const { data: signUpData, error: signUpError } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });
  if (signUpError) throw signUpError;
  if (!signUpData.user) {
    throw new Error("Could not create a Supabase user.");
  }

  const profile: ProfileRow = {
    id: signUpData.user.id,
    username: normalizedEmail,
    display_name: displayName,
    email: normalizedEmail,
    theme_id: "sky",
  };

  const { data: sessionData } = await client.auth.getSession();
  if (!sessionData.session) {
    return {
      ...mapProfile(profile),
      needsEmailConfirmation: true,
    };
  }

  const { data, error } = await client
    .from("profiles")
    .upsert(profile)
    .select("id, username, display_name, email, theme_id")
    .single<ProfileRow>();

  if (error) throw error;
  return mapProfile(data);
};

export const loginCloudProfile = async (email: string, password: string) => {
  const client = assertClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (signInError) throw signInError;
  if (!signInData.user) {
    throw new Error("Could not sign in.");
  }

  const { data, error } = await client
    .from("profiles")
    .select("id, username, display_name, email, theme_id")
    .eq("id", signInData.user.id)
    .single<ProfileRow>();

  if (error) throw error;
  return mapProfile(data);
};

export const logoutCloudProfile = async () => {
  const client = assertClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
};

export const sendCloudPasswordResetEmail = async (email: string) => {
  const client = assertClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
};

export const saveCloudProfile = async (profile: CloudUserProfile) => {
  const client = assertClient();
  const { data, error } = await client
    .from("profiles")
    .update({
      display_name: profile.displayName,
      email: profile.email,
      theme_id: profile.themeId,
      username: profile.name,
    })
    .eq("id", profile.id)
    .select("id, username, display_name, email, theme_id")
    .single<ProfileRow>();

  if (error) throw error;
  return mapProfile(data);
};

export const deleteCloudProfileData = async (userId: string) => {
  const client = assertClient();
  const loansResult = await client.from("saved_loans").delete().eq("user_id", userId);
  if (loansResult.error) throw loansResult.error;

  const profileResult = await client.from("profiles").delete().eq("id", userId);
  if (profileResult.error) throw profileResult.error;
};

export const loadCloudLoans = async <T extends CloudSavedLoanRecord>(userId: string): Promise<T[]> => {
  const client = assertClient();
  const { data, error } = await client
    .from("saved_loans")
    .select("id, name, data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .returns<SavedLoanRow[]>();

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    data: row.data,
  })) as T[];
};

export const saveCloudLoans = async (userId: string, loans: CloudSavedLoanRecord[]) => {
  const client = assertClient();
  const rows = loans.map((loan) => ({
    data: loan.data,
    id: loan.id,
    name: loan.name,
    user_id: userId,
  }));

  const currentResult = await client.from("saved_loans").select("id").eq("user_id", userId);
  if (currentResult.error) throw currentResult.error;

  const nextIds = new Set(rows.map((row) => row.id));
  const staleIds = (currentResult.data ?? [])
    .map((row) => row.id)
    .filter((id) => !nextIds.has(id));

  if (staleIds.length > 0) {
    const deleteResult = await client.from("saved_loans").delete().in("id", staleIds);
    if (deleteResult.error) throw deleteResult.error;
  }

  if (rows.length === 0) return;

  const upsertResult = await client.from("saved_loans").upsert(rows);
  if (upsertResult.error) throw upsertResult.error;
};

export const loadCloudPaycheckPlan = async <T>(userId: string): Promise<T | null> => {
  const client = assertClient();
  const { data, error } = await client
    .from("paycheck_plans")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle<{ data: T }>();
  if (error) throw error;
  return data?.data ?? null;
};

export const saveCloudPaycheckPlan = async (userId: string, data: unknown) => {
  const client = assertClient();
  const { error } = await client.from("paycheck_plans").upsert({ data, user_id: userId });
  if (error) throw error;
};
