import type { UserProfile } from "../types/profile";
import type { ThemeId } from "../constants/theme";

const THEME_IDS: ThemeId[] = ["sky", "forest", "sunset", "midnight", "rose", "slate"];

export function asThemeId(value: unknown): ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId)
    ? value as ThemeId
    : "sky";
}

export function normalizeProfile(profile: UserProfile): UserProfile {
  return { ...profile, themeId: asThemeId(profile.themeId) };
}
