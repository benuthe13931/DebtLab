export type ThemeId = "sky" | "forest" | "sunset" | "midnight" | "rose" | "slate";

export type ThemeDefinition = {
  accent: string;
  accentSoft: string;
  appBackground: string;
  cardBorder: string;
  cardShadow: string;
  isDark: boolean;
  name: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
};

export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  sky: {
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    appBackground: "linear-gradient(180deg, #eef4ff 0%, #f8fafc 240px, #f8fafc 100%)",
    cardBorder: "#dbe2ea",
    cardShadow: "0 20px 50px rgba(15, 23, 42, 0.08)",
    isDark: false,
    name: "Sky Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  forest: {
    accent: "#2f855a",
    accentSoft: "#dcfce7",
    appBackground: "linear-gradient(180deg, #ecfdf5 0%, #f7fee7 260px, #f8fafc 100%)",
    cardBorder: "#d1fae5",
    cardShadow: "0 20px 50px rgba(20, 83, 45, 0.10)",
    isDark: false,
    name: "Forest Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  sunset: {
    accent: "#ea580c",
    accentSoft: "#ffedd5",
    appBackground: "linear-gradient(180deg, #fff7ed 0%, #fef2f2 260px, #f8fafc 100%)",
    cardBorder: "#fed7aa",
    cardShadow: "0 20px 50px rgba(154, 52, 18, 0.10)",
    isDark: false,
    name: "Sunset Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  midnight: {
    accent: "#60a5fa",
    accentSoft: "#1e3a5f",
    appBackground: "linear-gradient(180deg, #020617 0%, #0f172a 220px, #111827 100%)",
    cardBorder: "#334155",
    cardShadow: "0 24px 60px rgba(2, 6, 23, 0.55)",
    isDark: true,
    name: "Midnight Ledger",
    surface: "#111827",
    surfaceMuted: "#1e293b",
    text: "#e2e8f0",
    textMuted: "#94a3b8",
  },
  rose: {
    accent: "#be185d",
    accentSoft: "#fce7f3",
    appBackground: "linear-gradient(180deg, #fdf2f8 0%, #fff1f2 260px, #f8fafc 100%)",
    cardBorder: "#fbcfe8",
    cardShadow: "0 20px 50px rgba(157, 23, 77, 0.10)",
    isDark: false,
    name: "Rose Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
  slate: {
    accent: "#475569",
    accentSoft: "#e2e8f0",
    appBackground: "linear-gradient(180deg, #f1f5f9 0%, #f8fafc 260px, #ffffff 100%)",
    cardBorder: "#cbd5e1",
    cardShadow: "0 20px 50px rgba(71, 85, 105, 0.10)",
    isDark: false,
    name: "Slate Ledger",
    surface: "#ffffff",
    surfaceMuted: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
  },
};

