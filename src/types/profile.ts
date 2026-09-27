import type { ThemeId } from "../constants/theme";

export type UserProfile = {
  displayName: string;
  email: string;
  id: string;
  name: string;
  password: string;
  passwordResetCode?: string;
  passwordResetIssuedAt?: string;
  themeId: ThemeId;
};
