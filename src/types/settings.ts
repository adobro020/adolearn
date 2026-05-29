/**
 * User-selectable app settings.
 * These settings are stored locally in the browser; API secrets stay on the server.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppSettings {
  modelName: string;
  theme: ThemePreference;
  dailyGoalMinutes: number;
  soundEffectsEnabled: boolean;
  remindersEnabled: boolean;
}
